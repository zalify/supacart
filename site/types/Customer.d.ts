export interface Group {
  groupId: string
  members: Member[]
}

export interface Member {
  email: string
  nickname: string
  uuid: string
  products: Products
  role: 'Owner' | 'Member'
  done?: boolean
}

export interface Products {
  items: Array<{ variantId: string | number; quantity: number }>
}
