export interface Group {
  id: string
  cartId: string
  status: 'cart' | 'checkout' | 'completed'
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
