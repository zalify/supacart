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
}

export interface Products {
  items: Array<{ variantId: string | number; quantity: number }>
}
