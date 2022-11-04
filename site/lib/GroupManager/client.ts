import { Group, Member } from 'types/Customer'

import Presence from '@yomo/presencejs'
import { nanoid } from 'nanoid'
import { flatMap, isEqual, sum } from 'lodash'
import axios from 'axios'
import Cookies from 'js-cookie'
import { makeAutoObservable, toJS } from 'mobx'
import {
  SHOPIFY_CHECKOUT_ID_COOKIE,
  SHOPIFY_CHECKOUT_URL_COOKIE,
} from '@framework/const'
import { store } from '@lib/store'

const USER_SESSION_ID = 'USER_SESSION_ID'
const GROUPId_KEY = 'GROUPId_KEY'

const getUserId = () => {
  if (typeof window === 'undefined') return ''
  let id = window.localStorage.getItem(USER_SESSION_ID)
  if (!id) {
    id = nanoid(10)
    window.localStorage.setItem(USER_SESSION_ID, id)
  }
  return id
}

const userId = getUserId()

export class GroupManager {
  groupId: string
  userId = userId
  initialize: Promise<any>
  private yomo: InstanceType<typeof Presence>

  private events: { [key: string]: ((...args: any[]) => any)[] } = {}
  private lastEventsData: { [key: string]: { time: number; data: any } } = {}
  groupData: Group | null = null
  inited: boolean = false

  constructor(groupId: string) {
    makeAutoObservable(this)

    this.groupId = groupId

    const yomo = (this.yomo = new Presence('https://prsc.yomo.dev', {
      auth: {
        // Certification Type
        type: 'token',
        // Api for getting access token
        endpoint: '/api/presence-auth',
      },
    }))

    this.initialize = Promise.all([
      this.fetchData(),
      new Promise((resolve) => {
        yomo.on('connected', () => {
          yomo.on(`change-product-${groupId}`, (data) => {
            this.exec(`change-product-${groupId}`, data)
          })
          yomo.on(`change-group-${groupId}`, (data) => {
            this.exec(`change-group-${groupId}`, data)
          })

          yomo.send(`connected-${groupId}`, userId)
          this.inited = true
          resolve(undefined)
        })
      }),
    ])
  }

  send = async (event: string, data: unknown) => {
    await this.initialize
    return this.yomo.send(event, data)
  }

  isOwner = () => {
    return this.currentMember?.role === 'Owner'
  }

  isDone = () => {
    return Boolean(this.currentMember?.done)
  }

  get products() {
    if (!this.groupData) return []
    return flatMap(this.groupData?.members.map((item) => item.products.items))
  }

  getVariants() {
    const variants: Record<string, number> = {}
    this.products.forEach((item) => {
      if (!variants[item.variantId]) {
        variants[item.variantId] = 0
      }

      variants[item.variantId] += item.quantity
    })
    return variants
  }

  get productItemCount() {
    return sum(this.products.map((item) => item.quantity))
  }

  get isCartEmpty() {
    return this.products.length === 0
  }

  get totalPrice() {
    return sum(
      this.products.map((item) => {
        const matchProduct = store.state.products.find((product) =>
          product.variants.find((variant) => variant.id === item.variantId)
        )
        const matchVariant = matchProduct?.variants.find(
          (variant) => variant.id === item.variantId
        )
        if (!matchVariant || !matchVariant.price) return 0

        return (matchVariant as any).price * item.quantity
      })
    )
  }

  async fetchData() {
    const groupData = await axios
      .get(`/api/groups/group`, {
        params: {
          groupId: this.groupId,
        },
      })
      .then((data) => data.data.data)
    this.groupData = groupData
  }

  updateProduct = async (
    type: 'add' | 'remove',
    variantId: number | string,
    quantity: number = 1
  ) => {
    try {
      const latestGroup = await axios
        .post('/api/groups/update-variants', {
          cartId: this.groupId,
          payload: {
            userId,
            variantId,
            type,
            quantity,
          },
        })
        .then((data) => data.data.data)
      this.yomo.send(`change-product-${this.groupId}`, {
        userId: userId,
        type,
        variantId,
      })
      this.yomo.send(`change-group-${this.groupId}`, latestGroup)

      this.updateProducts({ type, userId, variantId })
    } catch (error) {}
  }

  updateProducts = (payload: {
    type: 'add' | 'remove'
    userId: string
    variantId: string | number
  }) => {
    const { type, userId, variantId } = payload

    const matchMember = this.groupData?.members.find(
      (item) => item.uuid === userId
    )
    if (matchMember) {
      const matchVariant = matchMember.products.items.find((variant) => {
        variant.variantId === variantId
      })
      if (!matchVariant) return
      if (type === 'add') {
        matchVariant.quantity += 1
      } else {
        matchVariant.quantity = Math.max(matchVariant.quantity - 1, 0)
      }
    }
  }

  setGroup = (group: Group) => {
    this.groupData = group
  }

  isInCart = () => {
    return this.groupData?.status === 'cart'
  }

  isCheckout = () => {
    return this.groupData?.status === 'checkout'
  }

  isComplete = () => {
    return this.groupData?.status === 'completed'
  }

  static getGroupId = () => {
    if (typeof window === 'undefined') return
    return window.localStorage.getItem(GROUPId_KEY)
  }
  hasGroup = () => {
    return window.localStorage.getItem(GROUPId_KEY)
  }

  get currentMember() {
    return this.groupData?.members.find((item) => item.uuid === userId)
  }

  get getOwner() {
    return this.groupData?.members.find((item) => item.role === 'Owner')
  }

  toggleMemberDone = async () => {
    if (this.currentMember) {
      this.currentMember.done = !this.currentMember.done

      try {
        const groupData = await axios
          .post('/api/groups/update-member', {
            cartId: this.groupId,
            member: this.currentMember,
          })
          .then((data) => data.data.data)
        this.yomo.send(`change-group-${this.groupId}`, groupData)
        return groupData
      } catch (error) {}
    }
  }

  static openGroup = async (
    cartId: string,
    email: string,
    products: Member['products']
  ) => {
    const member: Member = {
      role: 'Owner',
      email,
      nickname: email,
      uuid: userId,
      products: products,
    }
    const data = (await axios
      .post('/api/groups/new', {
        cartId: cartId,
        member,
      })
      .then((data) => data.data.data)) as Group

    Cookies.set(SHOPIFY_CHECKOUT_ID_COOKIE, data.cartId)
    localStorage.setItem(GROUPId_KEY, data.id)
    return data
  }

  leaveGroup = () => {
    localStorage.removeItem(GROUPId_KEY)
  }

  static joinGroup = async (
    groupId: string,
    email: string,
    products: Member['products']
  ) => {
    const member: Member = {
      role: 'Member',
      email,
      nickname: email,
      uuid: userId,
      products: products,
    }
    const groupData = (await axios
      .post('/api/groups/join', {
        cartId: groupId,
        member,
      })
      .then((data) => data.data.data)) as Group

    localStorage.setItem(GROUPId_KEY, groupId)
    console.log(groupData.cartId, groupData)

    Cookies.set(SHOPIFY_CHECKOUT_ID_COOKIE, groupData.cartId)
    return groupData
  }

  destroy() {
    this.yomo.close()
  }

  on(type: string, handler: (...args: any[]) => any) {
    const event = this.events[type]
    if (!event) {
      this.events[type] = [handler]
    } else {
      event.push(handler)
    }
  }

  off(type: string, handler: (...args: any[]) => any) {
    this.events[type] = this.events[type].filter((h) => h !== handler)
  }

  exec(type: string, ...args: any[]): boolean {
    const event = this.events[type]

    if (!event) {
      return true
    }

    if (
      this.lastEventsData[type] &&
      new Date().getTime() - this.lastEventsData[type].time < 100 &&
      isEqual(this.lastEventsData[type].data, args)
    ) {
      return true
    }

    this.lastEventsData[type] = {
      time: new Date().getTime(),
      data: args,
    }

    let next = true
    event.forEach((handler) => {
      if (handler(...args) === false) {
        next = false
      }
    })
    return next
  }

  reset() {
    localStorage.setItem(GROUPId_KEY, '')
    Cookies.remove(SHOPIFY_CHECKOUT_ID_COOKIE)
    Cookies.remove(SHOPIFY_CHECKOUT_URL_COOKIE)
    Cookies.remove(USER_SESSION_ID)
    window.location.replace('/')
    console.log('reset')
  }

  beginCheckout = async () => {
    const latestGroup = (await axios
      .post('/api/groups/checkout', {
        cartId: this.groupId,
      })
      .then((data) => data.data.data)) as Group

    this.yomo.send(`change-group-${this.groupId}`, latestGroup)
  }

  resetToInCart = async () => {
    if (this.isComplete()) return
    const latestGroup = (await axios
      .post('/api/groups/cart', {
        cartId: this.groupId,
      })
      .then((data) => data.data.data)) as Group

    this.yomo.send(`change-group-${this.groupId}`, latestGroup)
  }

  complete = async () => {
    if (this.isComplete()) return
    const latestGroup = await axios
      .post('/api/groups/complete', {
        cartId: this.groupId,
      })
      .then((data) => data.data.data)

    this.yomo.send(`change-group-${this.groupId}`, latestGroup)
  }
}
