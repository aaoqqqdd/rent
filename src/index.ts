import { Hono } from 'hono'
import publicRoutes from './routes/public'
import customerRoutes from './routes/customer'
import staffRoutes from './routes/staff'
import adminRoutes from './routes/admin'

const app = new Hono()

app.route('/', publicRoutes)
app.route('/customer', customerRoutes)
app.route('/staff', staffRoutes)
app.route('/admin', adminRoutes)

app.get('/health', (c) => c.text('ok'))

const port = process.env.PORT || 3000
// Use Node.js native server via hono/node-server when available in runtime.
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { serve } = require('hono/node-server')
  serve(app, { port: Number(port) })
} catch (e) {
  // Fallback: start a minimal server using `@hono/node-server` not installed at runtime.
  // In dev mode `ts-node-dev` will still work with the above.
  console.log(`Please run with an environment that provides hono/node-server. PORT=${port}`)
}
