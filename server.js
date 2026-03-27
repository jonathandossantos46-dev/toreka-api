import express from "express"
import cors from "cors"
import fetch from "node-fetch"

const app = express()
app.use(cors())
app.use(express.json())

let dataCache = new Map()
let lastFetch = null

// 🔄 CardMarket
async function updateDatas() {
  const now = Date.now()
  if (lastFetch && now - lastFetch < 3600000) return

  const res = await fetch("https://downloads.s3.cardmarket.com/productCatalog/priceGuide/price_guide_6.json")
  const data = await res.json()

  dataCache = new Map(data.priceGuides.map(pg => [pg.idProduct, pg]))
  lastFetch = now

  console.log("✅ Données mises à jour")
}

// 💰 Calcul
function getMarketPrice(pg) {
  if (!pg) return null
  return (
    (pg.trend || 0) * 0.5 +
    (pg.avg7 || 0) * 0.3 +
    (pg.avg30 || 0) * 0.2
  )
}

function getBuyPrice(price) {
  let margin = 0.45
  if (price < 2) margin = 0.7
  if (price > 50) margin = 0.35
  return +(price * (1 - margin)).toFixed(2)
}

function getScore(pg) {
  let score = 50
  if (pg.trend > pg.avg30) score += 20
  if (pg.avg1 > pg.avg7) score += 15
  if (pg.low < pg.avg * 0.7) score -= 20
  if (pg.avg > 20) score += 10
  return Math.max(0, Math.min(100, score))
}

// 🔎 Récup carte Pokémon
async function getPokemonCard(id) {
  try {
    const res = await fetch(`https://api.pokemontcg.io/v2/cards?q=number:${id}`)
    const data = await res.json()

    if (!data.data || data.data.length === 0) return null

    const card = data.data[0]

    return {
      name: card.name,
      image: card.images.large,
      set: card.set.name
    }
  } catch {
    return null
  }
}

// 🚀 API finale
app.get("/price/:id", async (req, res) => {
  await updateDatas()

  const id = Number(req.params.id)
  const pg = dataCache.get(id)

  if (!pg) return res.json(null)

  const marketPrice = getMarketPrice(pg)
  const buyPrice = getBuyPrice(marketPrice)
  const score = getScore(pg)

  const cardInfo = await getPokemonCard(id)

  res.json({
    ...cardInfo,
    marketPrice,
    buyPrice,
    score
  })
})

// ❤️ test
app.get("/", (req, res) => {
  res.send("API Toreka OK")
})

app.listen(3000, () => console.log("🚀 API lancée"))
