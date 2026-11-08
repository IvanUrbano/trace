import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Fix default marker icons under Vite bundling.
delete (L.Icon.Default.prototype as { _getIconUrl?: unknown })._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

interface Props {
  value: string
  onChange: (value: string) => void
}

function DraggableMarker({ position, setPosition, onDragEnd }: {
  position: [number, number]
  setPosition: (p: [number, number]) => void
  onDragEnd: (p: [number, number]) => void
}) {
  useMapEvents({
    click(e) {
      setPosition([e.latlng.lat, e.latlng.lng])
      onDragEnd([e.latlng.lat, e.latlng.lng])
    },
  })
  return (
    <Marker
      position={position}
      draggable
      eventHandlers={{
        dragend: (e) => {
          const m = e.target.getLatLng()
          setPosition([m.lat, m.lng])
          onDragEnd([m.lat, m.lng])
        },
      }}
    />
  )
}

export function LocationMapPicker({ value, onChange }: Props) {
  const [position, setPosition] = useState<[number, number]>([14.5995, 120.9842]) // Manila default
  const [loading, setLoading] = useState(false)

  const reverseGeocode = async (lat: number, lng: number) => {
    setLoading(true)
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`, {
        headers: { 'accept-language': 'en' },
      })
      const data = await res.json()
      const name = data?.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`
      onChange(name)
    } catch {
      onChange(`${lat.toFixed(5)}, ${lng.toFixed(5)}`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // If value looks like coordinates, center there? Keep default.
  }, [])

  return (
    <div className="mt-2">
      <div className="overflow-hidden rounded-[3px] border border-line" style={{ height: 260 }}>
        <MapContainer center={position} zoom={13} style={{ height: '100%', width: '100%' }} scrollWheelZoom>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <DraggableMarker position={position} setPosition={setPosition} onDragEnd={(p) => void reverseGeocode(p[0], p[1])} />
        </MapContainer>
      </div>
      <p className="mt-2 text-xs text-muted">
        {loading ? 'Looking up address…' : value ? `Selected: ${value}` : 'Drag the pin or click the map to set the location.'}
      </p>
      <p className="mt-1 text-[10px] text-muted">
        Map data © OpenStreetMap contributors.
      </p>
    </div>
  )
}