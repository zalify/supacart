import cn from 'clsx'
import { FC, useMemo, useState } from 'react'
import s from './CartSidebarView.module.css'
import CartItem from '../CartItem'
import { Button, Text } from '@components/ui'
import { useUI } from '@components/ui/context'
import { Bag, Cross, Check } from '@components/icons'
import useCart from '@framework/cart/use-cart'
import usePrice from '@framework/product/use-price'
import SidebarLayout from '@components/common/SidebarLayout'
import { useGroupManager } from '@components/GroupManagerProvider'
import { observer } from 'mobx-react'
import { store } from '@lib/store'
import { LineItem } from '@commerce/types/cart'
import { useShopifyCart } from '@lib/hooks/useShopifyCart'

const CartSidebarView: FC = observer(() => {
  const { closeSidebar, setSidebarView } = useUI()
  const cartData = useCart()
  const { beginCheckout } = useShopifyCart()
  const { gm } = useGroupManager()
  const [doneLoading, setDoneLoading] = useState(false)
  const [checkoutLoading, setCheckoutLoading] = useState(false)

  const isEmpty = gm ? gm.isCartEmpty : cartData.isEmpty
  const isLoading = gm ? false : cartData.isLoading

  const totalPrice = (gm ? gm.totalPrice : cartData.data?.totalPrice) || 0

  const discountPrice = totalPrice >= 100 ? totalPrice * 0.2 : 0

  const { price: subTotal } = usePrice(
    cartData.data && {
      amount: totalPrice,
      currencyCode: cartData.data.currency.code,
    }
  )

  const { price: discount } = usePrice(
    cartData.data && {
      amount: discountPrice,
      currencyCode: cartData.data.currency.code,
    }
  )
  const { price: total } = usePrice(
    cartData.data && {
      amount: discountPrice > 0 ? totalPrice * 0.8 : Number(totalPrice),
      currencyCode: cartData.data.currency.code,
    }
  )

  const handleClose = () => closeSidebar()
  const onCheckout = async () => {
    setCheckoutLoading(true)
    await gm?.beginCheckout()
    // Update shopify order
    await beginCheckout()
    setTimeout(() => {
      window.location.assign('/checkout')
    }, 100)
    setCheckoutLoading(false)
  }

  const onToggleMemberDone = async () => {
    setDoneLoading(true)
    await gm?.toggleMemberDone()
    setDoneLoading(false)
  }

  const membersCartData = useMemo(() => {
    const members = gm?.groupData?.members

    if (!members) return null
    return members
      .map((member) => {
        return {
          ...member,
          products: member.products.items
            .map((item): LineItem | null => {
              const matchProduct = store.state.products.find((product) =>
                product.variants.find(
                  (variant) => variant.id === item.variantId
                )
              )

              const matchVariant = matchProduct?.variants.find(
                (variant) => variant.id === item.variantId
              )

              if (!matchVariant || !matchProduct) return null

              return {
                id: '', // line id
                productId: matchProduct.id,
                variantId: matchVariant.id,
                quantity: item.quantity,
                discounts: [],
                variant: {
                  image: {
                    url: matchProduct.images?.[0].url,
                  },
                  name: matchProduct.name,
                  ...matchVariant,
                } as any,
                path: matchProduct.path!,
                name: matchProduct.name!,
                options: [],
              }
            })
            .filter(Boolean),
        }
      })
      .sort((a, b) => (a.uuid === gm.userId ? -1 : 0))
  }, [gm?.groupData?.members, gm?.userId])

  const error = null
  const success = null

  return (
    <SidebarLayout
      className={cn({
        [s.empty]: error || success || isLoading || isEmpty,
      })}
      handleClose={handleClose}
    >
      {isLoading || isEmpty ? (
        <div className="flex-1 px-4 flex flex-col justify-center items-center">
          <span className="border border-dashed border-primary rounded-full flex items-center justify-center w-16 h-16 p-12 bg-secondary text-secondary">
            <Bag className="absolute" />
          </span>
          <h2 className="pt-6 text-2xl font-bold tracking-wide text-center">
            The cart is empty
          </h2>
          <p className="text-accent-3 px-10 text-center pt-2">
            Invite more friends to join your team!
          </p>
        </div>
      ) : error ? (
        <div className="flex-1 px-4 flex flex-col justify-center items-center">
          <span className="border border-white rounded-full flex items-center justify-center w-16 h-16">
            <Cross width={24} height={24} />
          </span>
          <h2 className="pt-6 text-xl font-light text-center">
            We couldn’t process the purchase. Please check your card information
            and try again.
          </h2>
        </div>
      ) : success ? (
        <div className="flex-1 px-4 flex flex-col justify-center items-center">
          <span className="border border-white rounded-full flex items-center justify-center w-16 h-16">
            <Check />
          </span>
          <h2 className="pt-6 text-xl font-light text-center">
            Thank you for your order.
          </h2>
        </div>
      ) : (
        <>
          <div className="px-4 sm:px-6 flex-1">
            {/* <Link href="/cart">
              <a> */}
            <Text variant="sectionHeading">
              Cart ({gm?.isInCart() && 'In Team'}
              {gm?.isCheckout() && 'The team leader is checking out'})
            </Text>
            {/* </a>
            </Link> */}
            <ul className={s.lineItemsList}>
              {membersCartData
                ? membersCartData?.map((member, index) => {
                    return (
                      <div key={index} className="py-4">
                        <div className="flex justify-between items-center">
                          <span className="capitalize">
                            {member.email}
                            {member.uuid === gm?.currentMember?.uuid
                              ? ` (Me)`
                              : null}
                            {member.role === 'Owner'
                              ? ` - The team leader`
                              : ''}
                          </span>
                          <span
                            className={cn(
                              'text-xs inline-flex items-center rounded px-1 py-0.5 font-medium',
                              member.done
                                ? ' bg-emerald-100 text-emerald-800'
                                : ' bg-orange-100 text-orange-800'
                            )}
                          >
                            {member.done ? 'Team is closed' : 'In Team'}
                          </span>
                        </div>
                        <ul>
                          {member.products.length > 0 ? (
                            member.products.map((item: any) => {
                              return (
                                <CartItem
                                  key={item.id}
                                  item={item}
                                  currencyCode={cartData.data?.currency.code!}
                                  variant={
                                    member.uuid === gm?.userId
                                      ? 'default'
                                      : 'display'
                                  }
                                />
                              )
                            })
                          ) : (
                            <p className="text-sm text-slate-900 py-2">
                              The cart is empty
                            </p>
                          )}
                        </ul>
                      </div>
                    )
                  })
                : cartData.data!.lineItems.map((item: any) => (
                    <CartItem
                      key={item.id}
                      item={item}
                      currencyCode={cartData.data?.currency.code!}
                    />
                  ))}
            </ul>
          </div>

          <div className="flex-shrink-0 px-6 py-6 sm:px-6 sticky z-20 bottom-0 w-full right-0 left-0 bg-accent-0 border-t text-sm">
            {discountPrice > 0 && (
              <ul className="pb-2">
                <li className="flex justify-between py-1">
                  <span>Subtotal</span>
                  <span>{subTotal}</span>
                </li>
                <li className="flex justify-between py-1">
                  <span>Discount</span>
                  <span>{discount}</span>
                </li>
              </ul>
            )}
            <div className="flex justify-between py-3 font-bold mb-2">
              <span>Total</span>
              <span>{total}</span>
            </div>
            {gm ? (
              <div>
                {gm.isOwner() ? (
                  gm.isCheckout() ? (
                    <>
                      <Button
                        loading={checkoutLoading}
                        onClick={onCheckout}
                        Component="a"
                        width="100%"
                      >
                        Proceed to Checkout
                      </Button>
                      {/* <div>----</div>
                      <Button
                        onClick={gm.resetToInCart}
                        Component="a"
                        width="100%"
                      >
                        Proceed to In Cart(Members can add product)
                      </Button> */}
                    </>
                  ) : (
                    <>
                      <Button onClick={onCheckout} Component="a" width="100%">
                        Proceed to Checkout
                      </Button>
                    </>
                  )
                ) : (
                  <>
                    {gm.isInCart() && (
                      <Button
                        onClick={onToggleMemberDone}
                        Component="a"
                        width="100%"
                        loading={doneLoading}
                      >
                        <>{gm.isDone() ? 'Keep shopping' : 'Finished'}</>
                      </Button>
                    )}
                    {gm.isCheckout() && (
                      <Button
                        disabled
                        Component="a"
                        width="100%"
                        loading={doneLoading}
                      >
                        The team leader is completing payment, you can close the
                        tab now.
                      </Button>
                    )}
                    {gm.isComplete() && (
                      <Button
                        disabled
                        Component="a"
                        width="100%"
                        loading={doneLoading}
                      >
                        The team leader has completed payment
                      </Button>
                    )}
                  </>
                )}
              </div>
            ) : (
              <div>
                <Button href="/checkout" Component="a" width="100%">
                  Proceed to Checkout
                </Button>
              </div>
            )}
          </div>
        </>
      )}
    </SidebarLayout>
  )
})

export default CartSidebarView
