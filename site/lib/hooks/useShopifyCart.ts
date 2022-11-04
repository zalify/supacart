import { LineItem } from '@commerce/types/cart'
import { useGroupManager } from '@components/GroupManagerProvider'
import useCart from '@framework/cart/use-cart'
import useAddItem from '@framework/cart/use-add-item'
import { useCallback, useMemo, useRef } from 'react'
import useRemoveItem from '@framework/cart/use-remove-item'
import { useRefState } from './useRefState'
import toast from 'react-hot-toast'
import { debounce } from 'lodash'

let isChange = false
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
        toast('「拼单进行中」的时候才能选购商品', { position: 'bottom-center' })
        throw new Error('Not in cart')
      }
      let { quantity = 1 } = item
      const type = quantity > 0 ? 'add' : 'remove'

      if (quantity !== 0) {
        gm?.updateProduct(type, item.variantId, Math.abs(quantity))
      }
    },
    [cartData, gm]
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
    gm?.updateProduct('remove', item.variantId, item.quantity)
  }

  const beginCheckout = async () => {
    const variants: Record<string, number> = {}
    gm?.products.forEach((item) => {
      if (!variants[item.variantId]) {
        variants[item.variantId] = 0
      }

      variants[item.variantId] += item.quantity
    })

    const data = Object.keys(variants).map((variantId) => ({
      quantity: variants[variantId],
      variantId,
    }))

    if (cartData.current && cartData.current.lineItems.length > 0) {
      await removeProductItem(
        cartData.current.lineItems.map((line) => {
          return {
            id: line.id,
          }
        })
      )
    }

    await addProductItem(data as any)
  }

  return {
    cart,
    addItem,
    addProductItem,
    increaseQuantity,
    removeItem,
    beginCheckout,
  }
}
