export type Property = {
  id: string
  address: string
  price: number
  beds: number
  baths: number
  sqft: number
  acres: number
  arv: number
  repairs: number
  lat: number
  lng: number
  photoUrl: string
  status: "New" | "Price Drop" | "Under Contract"
}

export const mockProperties: Property[] = [
  {
    id: "1",
    address: "123 Main St, Nashville, TN",
    price: 245000,
    beds: 3,
    baths: 2,
    sqft: 1480,
    acres: 0.19,
    arv: 335000,
    repairs: 45000,
    lat: 36.1627,
    lng: -86.7816,
    photoUrl: "https://photos.google.com/",
    status: "New",
  },
  {
    id: "2",
    address: "456 Oak Ave, Madison, TN",
    price: 189000,
    beds: 2,
    baths: 1,
    sqft: 1060,
    acres: 0.22,
    arv: 275000,
    repairs: 35000,
    lat: 36.2565,
    lng: -86.715,
    photoUrl: "https://photos.google.com/",
    status: "New",
  },
  {
    id: "3",
    address: "789 Cedar Ln, Antioch, TN",
    price: 310000,
    beds: 4,
    baths: 2,
    sqft: 1925,
    acres: 0.31,
    arv: 405000,
    repairs: 55000,
    lat: 36.0601,
    lng: -86.6711,
    photoUrl: "https://photos.google.com/",
    status: "New",
  },
]

export function formatMoney(n: number) {
  return `$${n.toLocaleString()}`
}
