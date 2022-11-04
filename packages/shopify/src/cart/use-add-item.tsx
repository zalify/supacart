import { useCallback } from 'react'
import type { MutationHook } from '@vercel/commerce/utils/types'
import useAddItem, { UseAddItem } from '@vercel/commerce/cart/use-add-item'
import type { AddItemHook } from '@vercel/commerce/types/cart'
import useCart from './use-cart'

import {
  checkoutLineItemAddMutation,
  getCheckoutId,
  checkoutToCart,
  checkoutCreate,
} from '../utils'
import { Mutation, MutationCheckoutLineItemsAddArgs } from '../../schema'

export default useAddItem as UseAddItem<typeof handler>

export const handler: MutationHook<AddItemHook> = {
  fetchOptions: {
    query: checkoutLineItemAddMutation,
  },
  async fetcher({ input, options, fetch }) {
    let lineItems: {
      variantId: string
      quantity: number
    }[] = []

    if (Array.isArray(input)) {
      lineItems = input.map((item) => ({
        variantId: item.variantId,
        quantity: item.quantity || 1,
      }))
    } else {
      const item = input

      lineItems =
        item.quantity === 0 && !item.variantId
          ? []
          : [
              {
                variantId: item.variantId,
                quantity: item.quantity || 1,
              },
            ]
    }

    let checkoutId = getCheckoutId()

    if (!checkoutId) {
      return checkoutToCart(await checkoutCreate(fetch, lineItems))
    } else {
      const { checkoutLineItemsAdd } = await fetch<
        Mutation,
        MutationCheckoutLineItemsAddArgs
      >({
        ...options,
        variables: {
          checkoutId,
          lineItems,
        },
      })
      return checkoutToCart(checkoutLineItemsAdd)
    }
  },
  useHook:
    ({ fetch }) =>
    () => {
      const { mutate } = useCart()
      return useCallback(
        async function addItem(input) {
          const data = await (fetch as any)({ input })
          await mutate(data, false)
          return data
        },
        [fetch, mutate]
      )
    },
}
