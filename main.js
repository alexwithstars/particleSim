import { FrameRateManager } from 'frame-rate-manager'

export const $ = sel => document.querySelector(sel)
export const $$ = sel => document.querySelectorAll(sel)
function canvasDPI (width, height, canvas, scale = false) {
  const ratio = window.devicePixelRatio
  canvas.width = width * ratio
  canvas.height = height * ratio
  canvas.style.width = width + 'px'
  canvas.style.height = height + 'px'
  scale && canvas.getContext('2d').scale(ratio, ratio)
}

const canvas = $('#canvas')
const ctx = canvas.getContext('2d')
function random (min, max) {
  [min, max] = [parseInt(min), parseInt(max)]
  if (min > max) { [min, max] = [max, min] }
  max++
  return Math.floor(Math.random() * (max - min) + min)
}

const maxSpeed = 1
class Ball {
  constructor (x, y, debug = false) {
    this.dx = maxSpeed * Math.random()
    if (Math.random() > 0.5) this.dx *= -1
    this.dy = maxSpeed * Math.random()
    if (Math.random() > 0.5) this.dy *= -1
    this.radius = 3
    this.debug = debug
    this.x = x ?? random(this.radius, canvas.width - this.radius)
    this.y = y ?? random(this.radius, canvas.height - this.radius)
  }

  draw () {
    ctx.beginPath()
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2, false)
    ctx.fillStyle = 'white'
    ctx.fill()
    ctx.closePath()
  }

  update () {
    this.x += this.dx
    this.y += this.dy
    if (this.x + this.radius > canvas.width || this.x - this.radius < 0) {
      if (this.x + this.radius > canvas.width) {
        this.x = canvas.width - (this.x + this.radius) % canvas.width - this.radius
      }
      if (this.x - this.radius < 0) {
        this.x = this.radius + Math.abs(this.x - this.radius)
      }
      this.dx = -this.dx
    }
    if (this.y + this.radius > canvas.height || this.y - this.radius < 0) {
      if (this.y + this.radius > canvas.height) {
        this.y = canvas.height - (this.y + this.radius) % canvas.height - this.radius
      }
      if (this.y - this.radius < 0) {
        this.y = this.radius + Math.abs(this.y - this.radius)
      }
      this.dy = -this.dy
    }
  }
}

class Space {
  constructor (canvas, ballsNum, umbral) {
    // properties
    this.umbral = umbral
    this.context = canvas.getContext('2d')
    this.width = canvas.width
    this.height = canvas.height

    // arrays
    this.directions = [
      [1, 0], [1, 1], [0, 1], [-1, 1]
    ]

    this.chunks = Array(Math.ceil(canvas.width / umbral))
      .fill(null)
      .map(() => Array(Math.ceil(canvas.height / umbral))
        .fill().map(() => []))

    this.balls = Array(ballsNum).fill(null)
      .map(() => {
        const ball = new Ball()
        const [chunkX, chunkY] = this.get(ball.x, ball.y)
        this.chunks[chunkX][chunkY].push(ball)
        return ball
      })
    const debugBall = new Ball(canvas.width - 50, canvas.height / 2, true)
    this.balls.push(debugBall)
    const [chunkX, chunkY] = this.get(debugBall.x, debugBall.y)
    this.chunks[chunkX][chunkY].push(debugBall)
  }

  get (x, y) {
    const chunkX = Math.floor(x / this.umbral)
    const chunkY = Math.floor(y / this.umbral)
    return [chunkX, chunkY]
  }

  set (x, y, b) {
    const [chunkX, chunkY] = this.get(x, y)
    this.chunks[chunkX][chunkY].push(b)
  }

  remove (x, y, b) {
    const [chunkX, chunkY] = this.get(x, y)
    const index = this.chunks[chunkX][chunkY].indexOf(b)
    if (index > -1) this.chunks[chunkX][chunkY].splice(index, 1)
  }

  getNeighbors (x, y) {
    const [chunkX, chunkY] = this.get(x, y)
    const neighbors = []
    for (const [cx, cy] of this.directions) {
      if (this.chunks[chunkX + cx] && this.chunks[chunkX + cx][chunkY + cy]) {
        neighbors.push(...this.chunks[chunkX + cx][chunkY + cy])
      }
    }
    return neighbors
  }

  checkAndConnect (ball, neighbor) {
    const dx = ball.x - neighbor.x
    const dy = ball.y - neighbor.y
    const distance = Math.sqrt(dx * dx + dy * dy)
    if (distance > this.umbral) return
    const alpha = (this.umbral - distance) / this.umbral
    this.context.beginPath()
    this.context.moveTo(ball.x, ball.y)
    this.context.lineTo(neighbor.x, neighbor.y)
    this.context.lineWidth = 1
    this.context.strokeStyle = `rgba(255, 255, 255, ${alpha})`
    this.context.stroke()
  }

  connectNeighbors () {
    for (const row of this.chunks) {
      for (const chunk of row) {
        if (chunk.length < 1) continue
        const neighbors = this.getNeighbors(chunk[0].x, chunk[0].y)
        for (let i = 0; i < chunk.length; i++) {
          const ball = chunk[i]
          for (let j = i + 1; j < chunk.length; j++) {
            const neighbor = chunk[j]
            this.checkAndConnect(ball, neighbor)
          }
          for (const neighbor of neighbors) {
            if (neighbor !== ball) {
              this.checkAndConnect(ball, neighbor)
            }
          }
        }
      }
    }
  }

  update () {
    for (const ball of this.balls) {
      const [oldX, oldY] = [ball.x, ball.y]
      const [oldChunkX, oldChunkY] = this.get(ball.x, ball.y)
      ball.update()
      ball.draw()
      const [newChunkX, newChunkY] = this.get(ball.x, ball.y)
      if (oldChunkX !== newChunkX || oldChunkY !== newChunkY) {
        this.remove(oldX, oldY, ball)
        this.set(ball.x, ball.y, ball)
      }
    }
  }
}

let space
let animationFrame
let last = 0
let elapsed = 0
let pass = 0

const manager = new FrameRateManager([
  {
    name: 'animate',
    executor: () => {
      const now = performance.now()
      pass += now - last
      if (pass >= 500) {
        pass = 0
        elapsed = now - last
      }
      last = now
      animate()
      ctx.font = '16px monospace'
      ctx.fillStyle = 'white'
      ctx.fillText(`fps: ${manager.getFps('animate')}`, 10, 20)
      ctx.fillText(`frametime: ${elapsed.toFixed(3)}ms`, 10, 40)
    }
  }
])

function init () {
  manager.stop()
  window.cancelAnimationFrame(animationFrame)
  canvas.width = window.innerWidth
  canvas.height = window.innerHeight
  canvasDPI(canvas.width, canvas.height, canvas)
  const ballsNum = 100
  const umbral = 200
  space = new Space(canvas, ballsNum, umbral)
  manager.start()
  // animationFrame = window.requestAnimationFrame(animate)
}

// eslint-disable-next-line
function debugChunks (umbral) {
  const chunksX = Math.ceil(canvas.width / umbral)
  const chunksY = Math.ceil(canvas.height / umbral)
  for (let i = 0; i < chunksX; i++) {
    for (let j = 0; j < chunksY; j++) {
      const alpha = ((j & 1) ? 0.1 : 0.05) + ((i & 1) ? 0.05 : 0.1)
      ctx.fillStyle = `rgba(255,255,255,${alpha})`
      ctx.fillRect(i * umbral, j * umbral, umbral, umbral)
    }
  }
}

function animate () {
  // animationFrame = window.requestAnimationFrame(animate)
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  // debugChunks(space.umbral)
  space.update()
  space.connectNeighbors()
}

window.addEventListener('resize', () => {
  init()
})

init()
