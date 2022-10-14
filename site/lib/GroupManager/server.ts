import { redis } from '@lib/redis'
import { nanoid } from 'nanoid'
import { Member, Group } from 'types/Customer'

export class GroupManager {
  static getKey = (key: string) => `group_${key}`

  static newGroup = async (cartId: string, owner: Member) => {
    const shortenId = nanoid(10)
    const group: Group = {
      id: shortenId,
      cartId: cartId,
      members: [owner],
      status: 'cart',
    }
    await redis.set(this.getKey(shortenId), JSON.stringify(group))
    return group
  }

  static updateMember = async (groupId: string, member: Member) => {
    const group: Group | null = await this.getGroup(groupId)

    if (!group) return null
    const matchMember = group.members.find((item) => item.uuid === member.uuid)
    if (matchMember) {
      Object.assign(matchMember, member)
    } else {
      group.members.push(member)
    }
    await redis.set(this.getKey(groupId), JSON.stringify(group))
    return group
  }

  static updateVariant = async (
    groupId: string,
    payload: {
      userId: string
      type: 'add' | 'remove'
      variantId: string | number
      quantity?: number
    }
  ) => {
    const { quantity = 1 } = payload
    const group: Group | null = await this.getGroup(groupId)
    if (!group) return null
    const matchMember = group.members.find(
      (item) => item.uuid === payload.userId
    )
    if (!matchMember) return group
    const matchVariant = matchMember.products.items.find(
      (item) => item.variantId === payload.variantId
    )
    if (matchVariant) {
      if (payload.type === 'add') {
        matchVariant.quantity += quantity
      } else {
        matchVariant.quantity = Math.max(matchVariant.quantity - quantity, 0)
      }

      if (matchVariant?.quantity === 0) {
        matchMember.products.items = matchMember.products.items.filter(
          (item) => item !== matchVariant
        )
      }
    } else {
      matchMember.products.items.push({
        quantity: 1,
        variantId: payload.variantId,
      })
    }

    await redis.set(this.getKey(groupId), JSON.stringify(group))
    return group
  }

  static getGroup = async (groupId: string) => {
    const groupString = await redis.get(this.getKey(groupId))
    if (!groupString) return null
    const group: Group = JSON.parse(groupString)
    return group
  }

  static beginCheckout = async (groupId: string) => {
    const group: Group | null = await this.getGroup(groupId)

    if (!group) return null
    if (group.status === 'cart') {
      group.status = 'checkout'
      await redis.set(this.getKey(groupId), JSON.stringify(group))
    }

    return group
  }

  static resetToInCart = async (groupId: string) => {
    const group: Group | null = await this.getGroup(groupId)

    if (!group) return null
    if (group.status === 'checkout') {
      group.status = 'cart'
      await redis.set(this.getKey(groupId), JSON.stringify(group))
    }

    return group
  }

  static complete = async (groupId: string) => {
    const group: Group | null = await this.getGroup(groupId)

    if (!group) return null
    group.status = 'completed'
    await redis.set(this.getKey(groupId), JSON.stringify(group))

    return group
  }
}
