import Cookies from 'js-cookie'

export const cartCookie = 'shopify_checkoutId'

export function getCartCookie() {
  return Cookies.get(cartCookie)
}
