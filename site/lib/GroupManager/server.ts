import { redis } from '@lib/redis'
import { Member, Group } from 'types/Customer'

export class GroupManager {
  static getKey = (key: string) => `group_${key}`

  static newGroup = async (cartId: string, owner: Member) => {
    const group: Group = {
      groupId: cartId,
      members: [owner],
    }
    await redis.set(this.getKey(cartId), JSON.stringify(group))
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
}
