## Supacart

Supacart is an open-source Shopify store Framework for building online shopping for multiple people with real-time synchronization.

Official Website: [https://supac.art/](https://supac.art/)

### First, you need to copy site/.env.template to site/.env, then populate all variables.

```bash
NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN=
NEXT_PUBLIC_SHOPIFY_STOREFRONT_ACCESS_TOKEN=

# login with your Github account on presencejs.yomo.run, get a free app_id and app_secret. Detail see https://github.com/yomorun/presencejs.
PRESENCE_APP_ID=
PRESENCE_APP_SECRET=

REDIS_URL=
```

### Development

```bash
  pnpm install
  pnpm run build ## build shopify package
  cd site
  pnpm run dev

```

Now you can see the content at http://localhost:3000

### Production

```bash
  pnpm install
  pnpm run build ## build shopify package
  cd site
  pnpm run start

```
