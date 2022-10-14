import { LineItem } from '@commerce/types/cart'
import { useGroupManager } from '@components/GroupManagerProvider'
import useCart from '@framework/cart/use-cart'
import useAddItem from '@framework/cart/use-add-item'
import { debounce } from 'lodash'
import { useCallback, useMemo, useRef } from 'react'
import useRemoveItem from '@framework/cart/use-remove-item'
import { useRefState } from './useRefState'

export function useShopifyCart() {
  const { gm } = useGroupManager()
  const cart = useCart()
  const cartData = useRefState(cart.data)
  const addProductItem = useAddItem()
  const removeProductItem = useRemoveItem()
  const diffRef = useRef(0)

  const addItem = useCallback(
    async (item: {
      variantId: string
      productId?: string
      quantity?: number
      id?: string
    }) => {
      const isCheckout = !item.quantity && !item.variantId
      if (!cartData || (!gm?.isInCart() && !isCheckout)) {
        alert('Only can update product if in cart status')
        throw new Error('Not in cart')
      }

      let { quantity = 1 } = item
      const type = quantity > 0 ? 'add' : 'remove'
      try {
        await addProductItem(item)
      } catch (error: any) {
        if (
          error
            .toString()
            .includes('Quantity must be greater than or equal to 1')
        ) {
          await removeProductItem({
            id: item.id!,
          })
        }
      }
      if (quantity !== 0) {
        gm?.updateProduct(type, item.variantId, Math.abs(quantity))
      }
    },
    [addProductItem, cartData, gm, removeProductItem]
  )

  const onCallUpdateItem = useMemo(() => {
    return debounce(async (item: LineItem, n: number) => {
      diffRef.current = 0
      return addItem({
        id: item.id,
        productId: String(item.id),
        variantId: String(item.variantId),
        quantity: n,
      })
    }, 500)
  }, [addItem])

  const increaseQuantity = async (item: LineItem, n = 1) => {
    diffRef.current += n
    return onCallUpdateItem(item, diffRef.current)
  }

  const removeItem = async (item: LineItem) => {
    await addItem({
      productId: String(item.id),
      variantId: String(item.variantId),
      quantity: -item.quantity,
    })
    gm?.updateProduct('remove', item.variantId, item.quantity)
  }

  return {
    cart,
    addItem,
    addProductItem,
    increaseQuantity,
    removeItem,
  }
}
