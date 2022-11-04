import { Product } from '@commerce/types/product'
import { makeAutoObservable } from 'mobx'

class State {
  constructor() {
    makeAutoObservable(this)
  }

  products: Product[] = []

  setProducts(products: Product[]) {
    this.products = products
  }
}

export const state = new State()
