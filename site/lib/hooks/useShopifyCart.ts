import { LineItem } from '@commerce/types/cart'
import { useGroupManager } from '@components/GroupManagerProvider'
import useCart from '@framework/cart/use-cart'
import useAddItem from '@framework/cart/use-add-item'
import { debounce } from 'lodash'
import { useCallback, useMemo, useRef } from 'react'

export function useShopifyCart() {
  const { gm } = useGroupManager()
  const cart = useCart()
  const addProductItem = useAddItem()
  const diffRef = useRef(0)

  const addItem = useCallback(
    async (item: {
      variantId: string
      productId?: string
      quantity?: number
    }) => {
      const isCheckout = !item.quantity && !item.variantId
      if (!gm?.isInCart() && !isCheckout) {
        alert('Only can update product if in cart status')
        throw new Error('Not in cart')
      }
      let { quantity = 1 } = item
      const data = await addProductItem(item)
      if (quantity !== 0) {
        gm?.updateProduct(
          quantity > 0 ? 'add' : 'remove',
          item.variantId,
          Math.abs(quantity)
        )
      }
      return data
    },
    [addProductItem, gm]
  )

  const onCallUpdateItem = useMemo(() => {
    return debounce(async (item: LineItem, n: number) => {
      diffRef.current = 0
      return addItem({
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
    increaseQuantity,
    removeItem,
  }
}
