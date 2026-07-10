import { Hono } from 'hono'
import { createServer } from 'http'
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

const port = Number(process.env.PORT || 3000)

const server = createServer(async (req, res) => {
  const url = `http://${req.headers.host}${req.url}`
  const request = new Request(url, {
    method: req.method,
    headers: req.headers as unknown as Headers,
    body: req.method !== 'GET' && req.method !== 'HEAD' ? (req as unknown as BodyInit) : undefined,
  })

  const response = await app.fetch(request)
  const headers = Object.fromEntries(response.headers.entries())
  res.writeHead(response.status, headers)

  const buffer = Buffer.from(await response.arrayBuffer())
  res.end(buffer)
})

server.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`)
})
