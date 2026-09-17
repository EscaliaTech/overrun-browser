import { useEffect, useState } from 'react'
import type { AppInfo } from '../../shared/events'

export function AboutDialog({ onClose }: { onClose: () => void }): JSX.Element {
  const [info, setInfo] = useState<AppInfo | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')

  useEffect(() => { void window.overrun.getAppInfo().then(setInfo).catch(() => setNotice('No se pudo leer la información de la app.')) }, [])
  const setDefault = async (enabled: boolean): Promise<void> => {
    setBusy(true)
    try {
      const next = await window.overrun.setDefaultBrowser(enabled)
      setInfo(next)
      setNotice(next.defaultBrowserRegistered
        ? 'Protocolos HTTP/HTTPS registrados. El SO puede pedir confirmación adicional.'
        : 'Registro de navegador predeterminado desactivado.')
    } catch {
      setNotice('El sistema no permitió actualizar el registro.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 45 }} />
      <section role="dialog" aria-modal="true" aria-labelledby="about-title"
        style={{ position: 'fixed', top: 110, right: 14, zIndex: 50, width: 340, padding: 18, borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--line)', boxShadow: '0 18px 44px -14px rgba(0,0,0,.7)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ width: 34, height: 34, display: 'grid', placeItems: 'center', borderRadius: 9, background: '#101318', border: '1px solid #2a3038', color: 'var(--cyan)' }}>▶</div>
          <div style={{ flex: 1 }}><h2 id="about-title" style={{ margin: 0, fontSize: 16 }}>Overrun</h2>
            <p style={{ margin: '3px 0 0', color: 'var(--dim)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>v{info?.version ?? '…'} · Chromium observability</p></div>
          <button onClick={onClose} aria-label="Cerrar About" style={closeBtn}>X</button>
        </div>
        <p style={copy}>Navegador de desarrollo con herramientas flotantes que no reducen el viewport de la página.</p>
        <div style={{ paddingTop: 12, borderTop: '1px solid var(--line-soft)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <label style={{ flex: 1, fontSize: 12 }}>Usar para enlaces HTTP/HTTPS</label>
            <button disabled={busy} onClick={() => void setDefault(!info?.defaultBrowserRegistered)} style={toggle}>
              {info?.defaultBrowserRegistered ? 'Activo' : 'Activar'}
            </button>
          </div>
          <p style={{ ...copy, marginBottom: 0, fontSize: 10 }}>Es opcional y se puede cambiar desde la configuración del sistema.</p>
          {notice && <p role="status" style={{ margin: '8px 0 0', color: 'var(--cyan-bright)', fontSize: 10 }}>{notice}</p>}
        </div>
      </section>
    </>
  )
}

const copy = { margin: '16px 0', color: 'var(--dim)', lineHeight: 1.5, fontSize: 11 }
const closeBtn = { width: 28, height: 28, border: 'none', borderRadius: 6, background: 'transparent', color: 'var(--dim)', cursor: 'pointer' }
const toggle = { minWidth: 66, height: 28, border: '1px solid oklch(0.82 0.15 195 / .5)', borderRadius: 6, background: 'oklch(0.82 0.15 195 / .14)', color: 'var(--cyan-bright)', cursor: 'pointer', fontSize: 11 }
