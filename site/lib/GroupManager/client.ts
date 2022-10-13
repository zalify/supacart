import { Group, Member } from 'types/Customer'

import Presence from '@yomo/presencejs'
import { nanoid } from 'nanoid'
import { isEqual } from 'lodash'
import axios from 'axios'
import Cookies from 'js-cookie'
import { cartCookie } from '@lib/getCartCookie'
import { makeAutoObservable, toJS } from 'mobx'

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
          resolve(undefined)
        })
      }),
    ])
  }

  send = async (event: string, data: unknown) => {
    await this.initialize
    return this.yomo.send(event, data)
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
    variantId: number | string
  ) => {
    try {
      const latestGroup = await axios
        .post('/api/groups/update-variants', {
          cartId: this.groupId,
          payload: {
            userId,
            variantId,
            type,
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

  hasGroup = () => {
    return localStorage.getItem(GROUPId_KEY)
  }

  get currentMember() {
    return this.groupData?.members.find((item) => item.uuid === userId)
  }

  static openGroup = async (
    groupId: string,
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
    try {
      await axios.post('/api/groups/new', {
        cartId: groupId,
        member,
      })
      localStorage.setItem(GROUPId_KEY, groupId)
    } catch (error) {}
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
    try {
      const groupData = await axios
        .post('/api/groups/join', {
          cartId: groupId,
          member,
        })
        .then((data) => data.data.data)

      localStorage.setItem(GROUPId_KEY, groupId)

      Cookies.set(cartCookie, groupId)
      return groupData
    } catch (error) {}
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
}
