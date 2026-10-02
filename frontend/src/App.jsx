import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft, Bell, Check, Clapperboard, Clock3, Compass, Eye, Film, Home,
  Library, LogOut, MessageCircle, Pencil, Play, Plus, Search, Trash2, Upload, X,
} from 'lucide-react'
import { authApi } from './api/auth.js'
import { commentsApi } from './api/comments.js'
import { videosApi } from './api/videos.js'
import './App.css'

const FALLBACK_THUMBNAIL = 'https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?auto=format&fit=crop&w=1000&q=80'

function prettyDate(value) {
  return new Intl.DateTimeFormat('es', { dateStyle: 'medium' }).format(new Date(value))
}

function VideoCard({ video, onOpen }) {
  return (
    <button className="video-card" type="button" onClick={() => onOpen(video.id)}>
      <span className="thumbnail-wrap">
        <img className="video-thumbnail" src={video.thumbnail_url || FALLBACK_THUMBNAIL} alt={`Miniatura de ${video.title}`} onError={(event) => { event.currentTarget.src = FALLBACK_THUMBNAIL }} />
        <span className="play-badge" aria-label="Reproducir"><Play size={16} fill="currentColor" /></span>
        <span className="duration-tag">VIDEO</span>
      </span>
      <span className="video-card-copy">
        <span className="creator-avatar" aria-hidden="true">{video.username?.slice(0, 1).toUpperCase() || 'C'}</span>
        <span className="video-card-text">
          <strong>{video.title}</strong>
          <span>{video.username}</span>
          <span>{Number(video.views).toLocaleString('es')} vistas <i>·</i> {prettyDate(video.created_at)}</span>
        </span>
      </span>
    </button>
  )
}

function App() {
  const [page, setPage] = useState('home')
  const [videos, setVideos] = useState([])
  const [myVideos, setMyVideos] = useState([])
  const [currentVideo, setCurrentVideo] = useState(null)
  const [recommendedVideos, setRecommendedVideos] = useState([])
  const [comments, setComments] = useState([])
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem('clipoteca_user') || 'null'))
  const [token, setToken] = useState(() => localStorage.getItem('clipoteca_token') || '')
  const [query, setQuery] = useState('')
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [authMode, setAuthMode] = useState('login')
  const [showUpload, setShowUpload] = useState(false)
  const [editingVideo, setEditingVideo] = useState(null)
  const [sortNewest, setSortNewest] = useState(true)
  const currentVideoId = currentVideo?.id

  useEffect(() => {
    videosApi.list()
      .then(setVideos)
      .catch((error) => setNotice(`No se pudo conectar con la API: ${error.message}`))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!currentVideoId) return
    commentsApi.list(currentVideoId)
      .then(setComments)
      .catch((error) => setNotice(error.message))
  }, [currentVideoId])

  useEffect(() => {
    if (!currentVideoId) return
    videosApi.recommendations(currentVideoId)
      .then(setRecommendedVideos)
      .catch((error) => setNotice(error.message))
  }, [currentVideoId])

  const visibleVideos = useMemo(() => {
    const term = query.trim().toLocaleLowerCase('es')
    return videos
      .filter((video) => !term || `${video.title} ${video.username} ${video.description}`.toLocaleLowerCase('es').includes(term))
      .sort((a, b) => sortNewest
        ? new Date(b.created_at) - new Date(a.created_at)
        : new Date(a.created_at) - new Date(b.created_at))
  }, [query, sortNewest, videos])

  async function openVideo(videoId) {
    setNotice('')
    try {
      const video = await videosApi.get(videoId)
      setCurrentVideo(video)
      setPage('player')
    } catch (error) {
      setNotice(error.message)
    }
  }

  async function showProfile() {
    if (!user) {
      setAuthMode('login')
      setPage('auth')
      return
    }
    setNotice('')
    try {
      setMyVideos(await videosApi.listByUser(user.id))
      setPage('profile')
    } catch (error) {
      setNotice(error.message)
    }
  }

  async function submitAuth(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const credentials = { email: form.get('email'), password: form.get('password') }
    setBusy(true)
    setNotice('')
    try {
      if (authMode === 'register') {
        await authApi.register({ name: form.get('name'), ...credentials })
      }
      const result = await authApi.login(credentials)
      localStorage.setItem('clipoteca_token', result.access_token)
      localStorage.setItem('clipoteca_user', JSON.stringify(result.user))
      setToken(result.access_token)
      setUser(result.user)
      setPage('home')
      setNotice(`Hola, ${result.user.name}. Ya puedes publicar y comentar.`)
    } catch (error) {
      setNotice(error.message)
    } finally {
      setBusy(false)
    }
  }

  function signOut() {
    localStorage.removeItem('clipoteca_token')
    localStorage.removeItem('clipoteca_user')
    setToken('')
    setUser(null)
    setPage('home')
    setNotice('Has cerrado sesión.')
  }

  async function publishComment(event) {
    event.preventDefault()
    if (!user || !currentVideo) return
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    const content = String(form.get('content') || '').trim()
    if (!content) return
    try {
      const comment = await commentsApi.create(currentVideo.id, content, token)
      setComments((current) => [...current, comment])
      formElement.reset()
    } catch (error) {
      setNotice(error.message)
    }
  }

  async function publishVideo(event) {
    event.preventDefault()
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    const videoFile = form.get('video')
    const thumbnailFile = form.get('thumbnail')
    if (!(videoFile instanceof File) || !videoFile.size || !(thumbnailFile instanceof File) || !thumbnailFile.size) {
      setNotice('Selecciona un MP4 y una imagen para la miniatura.')
      return
    }
    setBusy(true)
    setNotice('Subiendo archivos a S3…')
    try {
      const upload = new FormData()
      upload.append('title', String(form.get('title') || ''))
      upload.append('description', String(form.get('description') || ''))
      upload.append('video_file', videoFile)
      upload.append('thumbnail_file', thumbnailFile)
      await videosApi.create(upload, token)
      const refreshed = await videosApi.list()
      setVideos(refreshed)
      setMyVideos(refreshed.filter((video) => video.user_id === user.id))
      setShowUpload(false)
      setNotice('Tu video ya está publicado.')
      formElement.reset()
    } catch (error) {
      setNotice(error.message)
    } finally {
      setBusy(false)
    }
  }

  async function saveVideo(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    try {
      const updated = await videosApi.update(editingVideo.id, {
        title: form.get('title'), description: form.get('description'),
      }, token)
      setMyVideos((current) => current.map((video) => video.id === updated.id ? updated : video))
      setVideos((current) => current.map((video) => video.id === updated.id ? updated : video))
      setEditingVideo(null)
      setNotice('Cambios guardados.')
    } catch (error) {
      setNotice(error.message)
    }
  }

  async function removeVideo(video) {
    if (!window.confirm(`¿Eliminar “${video.title}”? Esta acción no se puede deshacer.`)) return
    try {
      await videosApi.delete(video.id, token)
      setMyVideos((current) => current.filter((item) => item.id !== video.id))
      setVideos((current) => current.filter((item) => item.id !== video.id))
      setNotice('Video eliminado.')
    } catch (error) {
      setNotice(error.message)
    }
  }

  return (
    <div className="app-frame">
      <aside className="sidebar">
        <button className="brand" type="button" onClick={() => setPage('home')} aria-label="Clipoteca, inicio">
          <span className="brand-mark"><Play size={17} fill="currentColor" /></span><span>clipoteca</span>
        </button>
        <span className="sidebar-label">EXPLORAR</span>
        <nav className="main-nav" aria-label="Navegación principal">
          <button className={page === 'home' ? 'nav-link active' : 'nav-link'} type="button" onClick={() => setPage('home')}><Home size={18} /><span>Inicio</span></button>
          <button className="nav-link" type="button" onClick={showProfile}><Library size={18} /><span>Mi biblioteca</span></button>
          <button className="nav-link" type="button" onClick={() => { setAuthMode('register'); setPage('auth') }}><Compass size={18} /><span>Crear cuenta</span></button>
        </nav>
        <div className="sidebar-rule" />
        <div className="sidebar-note"><span className="note-icon"><Clapperboard size={17} /></span><p>Un lugar pequeño para buenas historias.</p><span>Hecho para compartir</span></div>
        <div className="sidebar-bottom">
          {user ? (
            <button className="account-link" type="button" onClick={showProfile}><span className="creator-avatar">{user.name.slice(0, 1).toUpperCase()}</span><span><strong>{user.name}</strong><small>Ver perfil</small></span></button>
          ) : <button className="sign-in-link" type="button" onClick={() => { setAuthMode('login'); setPage('auth') }}>Iniciar sesión <ArrowLeft size={15} /></button>}
        </div>
      </aside>

      <div className="content-area">
        <header className="topbar">
          <div className="mobile-brand"><span className="brand-mark"><Play size={16} fill="currentColor" /></span> clipoteca</div>
          <label className="search-field"><Search size={18} aria-hidden="true" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar videos o creadores" aria-label="Buscar videos o creadores" /><kbd>⌘ K</kbd></label>
          <div className="topbar-actions">
            {user ? <><button className="icon-button" type="button" title="Notificaciones" aria-label="Notificaciones"><Bell size={18} /></button><button className="avatar-button" type="button" onClick={showProfile} aria-label="Abrir perfil">{user.name.slice(0, 1).toUpperCase()}</button></> : <button className="top-sign-in" type="button" onClick={() => { setAuthMode('login'); setPage('auth') }}>Entrar</button>}
          </div>
        </header>

        {notice && <div className="notice" role="status"><span>{notice}</span><button type="button" onClick={() => setNotice('')} aria-label="Cerrar mensaje"><X size={16} /></button></div>}

        {page === 'home' && (
          <main className="page-content">
            <section className="catalog-section" id="video-list">
              <div className="section-heading"><div><span className="eyebrow muted-eyebrow">PARA MIRAR</span><h2>{query ? 'Resultados' : 'Videos recientes'}</h2></div><button className="sort-button" type="button" onClick={() => setSortNewest((current) => !current)}><Clock3 size={15} /> {sortNewest ? 'Recientes' : 'Antiguos'}</button></div>
              {loading ? <div className="empty-state"><span className="loading-mark"><Film size={20} /></span><p>Cargando videos…</p></div> : visibleVideos.length ? <div className="video-grid">{visibleVideos.map((video) => <VideoCard key={video.id} video={video} onOpen={openVideo} />)}</div> : (
                <div className="empty-state"><span className="empty-icon"><Film size={24} /></span><h3>{query ? 'No encontramos coincidencias' : 'La videoteca está empezando'}</h3><p>{query ? 'Prueba con otro título o creador.' : 'Cuando se publique el primer video, aparecerá aquí.'}</p>{user && <button className="outline-button" type="button" onClick={showProfile}><Plus size={16} /> Publicar el primero</button>}</div>
              )}
            </section>
            <footer className="page-footer"><span>CLIPOTECA · PROYECTO UNIVERSITARIO</span><span>Videos de la comunidad, en un solo lugar.</span></footer>
          </main>
        )}

        {page === 'auth' && (
          <main className="auth-layout"><div className="auth-image"><span>UN ESPACIO<br />PARA COMPARTIR</span></div><section className="auth-panel"><span className="eyebrow muted-eyebrow">{authMode === 'register' ? 'EMPIEZA AQUÍ' : 'QUÉ BUENO VERTE'}</span><h1>{authMode === 'register' ? 'Crea tu cuenta.' : 'Vuelve a la comunidad.'}</h1><p className="auth-intro">Publica videos, deja comentarios y arma tu propia biblioteca.</p>
            <form className="stack-form" onSubmit={submitAuth}>{authMode === 'register' && <label>Nombre<input name="name" type="text" minLength="2" maxLength="80" autoComplete="name" required /></label>}<label>Correo electrónico<input name="email" type="email" autoComplete="email" required /></label><label>Contraseña<input name="password" type="password" minLength="8" maxLength="128" autoComplete={authMode === 'register' ? 'new-password' : 'current-password'} required /></label><button className="primary-button full-button" type="submit" disabled={busy}>{busy ? 'Un momento…' : authMode === 'register' ? 'Crear cuenta' : 'Iniciar sesión'}</button></form>
            <p className="switch-auth">{authMode === 'register' ? '¿Ya tienes cuenta?' : '¿Es tu primera vez?'} <button type="button" onClick={() => setAuthMode(authMode === 'register' ? 'login' : 'register')}>{authMode === 'register' ? 'Inicia sesión' : 'Crea una cuenta'}</button></p>
          </section></main>
        )}

        {page === 'player' && currentVideo && (
          <main className="player-layout"><button className="back-link" type="button" onClick={() => setPage('home')}><ArrowLeft size={16} /> Volver a explorar</button><div className="player-columns">
            <section className="player-main"><div className="player-screen"><video key={currentVideo.video_url} src={currentVideo.video_url} poster={currentVideo.thumbnail_url} controls playsInline /></div><h1 className="player-title">{currentVideo.title}</h1>
              <div className="video-meta-row"><div className="creator-line"><span className="creator-avatar">{currentVideo.username.slice(0, 1).toUpperCase()}</span><span><strong>{currentVideo.username}</strong><small>Publicado el {prettyDate(currentVideo.created_at)}</small></span></div><span className="meta-stat"><Eye size={16} /> {Number(currentVideo.views).toLocaleString('es')} vistas</span></div>
              <div className="description-block">{currentVideo.description || 'Este video no tiene descripción.'}</div>
              <section className="comments-section"><h2><MessageCircle size={19} /> Comentarios <span>{comments.length}</span></h2>
                {user ? <form className="comment-form" onSubmit={publishComment}><span className="creator-avatar">{user.name.slice(0, 1).toUpperCase()}</span><input name="content" placeholder="Escribe un comentario…" maxLength="1000" required /><button type="submit" aria-label="Enviar comentario"><ArrowLeft size={17} /></button></form> : <p className="comment-sign-in">Inicia sesión para dejar un comentario.</p>}
                <div className="comment-list">{comments.map((comment) => <article className="comment-item" key={comment.id}><span className="creator-avatar">{comment.username.slice(0, 1).toUpperCase()}</span><div><strong>{comment.username}</strong><time>{prettyDate(comment.created_at)}</time><p>{comment.content}</p></div></article>)}{!comments.length && <p className="no-comments">Todavía no hay comentarios.</p>}</div>
              </section>
            </section>
            <aside className="recommendations"><span className="eyebrow muted-eyebrow">SIGUE MIRANDO</span><h2>También te puede gustar</h2>{recommendedVideos.map((video) => <button className="recommendation-item" key={video.id} type="button" onClick={() => openVideo(video.id)}><span className="recommendation-thumb"><img src={video.thumbnail_url || FALLBACK_THUMBNAIL} alt="" /></span><span><strong>{video.title}</strong><small>{video.username}</small><small>{Number(video.views).toLocaleString('es')} vistas</small></span></button>)}{recommendedVideos.length === 0 && <p className="recommendation-empty">Los próximos videos aparecerán aquí.</p>}</aside>
          </div></main>
        )}

        {page === 'profile' && user && (
          <main className="profile-layout"><section className="profile-heading"><div className="profile-avatar">{user.name.slice(0, 1).toUpperCase()}</div><div className="profile-info"><span className="eyebrow muted-eyebrow">TU ESPACIO</span><h1>{user.name}</h1><p>{user.email}</p><span className="video-count">{myVideos.length} {myVideos.length === 1 ? 'video publicado' : 'videos publicados'}</span></div><button className="quiet-button" type="button" onClick={signOut}><LogOut size={16} /> Cerrar sesión</button></section>
            <section className="profile-videos"><div className="section-heading"><div><span className="eyebrow muted-eyebrow">TU CANAL</span><h2>Mis videos</h2></div><button className="primary-button" type="button" onClick={() => setShowUpload(true)}><Upload size={16} /> Publicar video</button></div>
              {myVideos.length ? <div className="profile-video-list">{myVideos.map((video) => <article className="profile-video-row" key={video.id}><button className="profile-video-preview" type="button" onClick={() => openVideo(video.id)}><img src={video.thumbnail_url || FALLBACK_THUMBNAIL} alt={`Miniatura de ${video.title}`} /></button><button className="profile-video-details" type="button" onClick={() => openVideo(video.id)}><strong>{video.title}</strong><span>{Number(video.views).toLocaleString('es')} vistas · {prettyDate(video.created_at)}</span><small>{video.description || 'Sin descripción'}</small></button><div className="row-actions"><button className="icon-button" type="button" title="Editar video" aria-label={`Editar ${video.title}`} onClick={() => setEditingVideo(video)}><Pencil size={16} /></button><button className="icon-button danger-action" type="button" title="Eliminar video" aria-label={`Eliminar ${video.title}`} onClick={() => removeVideo(video)}><Trash2 size={16} /></button></div></article>)}</div> : <div className="empty-state profile-empty"><span className="empty-icon"><Film size={24} /></span><h3>Aún no has publicado videos</h3><p>Elige un MP4 y una miniatura para compartir tu primer video.</p><button className="outline-button" type="button" onClick={() => setShowUpload(true)}><Plus size={16} /> Publicar video</button></div>}
            </section></main>
        )}
      </div>

      {showUpload && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowUpload(false) }}><section className="dialog" role="dialog" aria-modal="true" aria-labelledby="upload-title"><div className="dialog-heading"><div><span className="eyebrow muted-eyebrow">NUEVA PUBLICACIÓN</span><h2 id="upload-title">Comparte un video</h2></div><button className="icon-button" type="button" onClick={() => setShowUpload(false)} aria-label="Cerrar"><X size={19} /></button></div><form className="stack-form upload-form" onSubmit={publishVideo}><label>Título<input name="title" minLength="2" maxLength="120" placeholder="¿De qué trata tu video?" required /></label><label>Descripción<textarea name="description" maxLength="3000" rows="3" placeholder="Agrega un poco de contexto…" /></label><label>Archivo de video (MP4, máximo 100 MB)<input name="video" type="file" accept="video/mp4,.mp4" required /></label><label>Miniatura (JPG o PNG, máximo 5 MB)<input name="thumbnail" type="file" accept="image/jpeg,image/png,.jpg,.jpeg,.png" required /></label><div className="dialog-actions"><button className="quiet-button" type="button" onClick={() => setShowUpload(false)}>Cancelar</button><button className="primary-button" type="submit" disabled={busy}><Upload size={16} /> {busy ? 'Subiendo…' : 'Publicar video'}</button></div></form></section></div>}

      {editingVideo && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditingVideo(null) }}><section className="dialog" role="dialog" aria-modal="true" aria-labelledby="edit-title"><div className="dialog-heading"><div><span className="eyebrow muted-eyebrow">EDITAR PUBLICACIÓN</span><h2 id="edit-title">Actualiza tu video</h2></div><button className="icon-button" type="button" onClick={() => setEditingVideo(null)} aria-label="Cerrar"><X size={19} /></button></div><form className="stack-form upload-form" onSubmit={saveVideo}><label>Título<input name="title" defaultValue={editingVideo.title} minLength="2" maxLength="120" required /></label><label>Descripción<textarea name="description" defaultValue={editingVideo.description} maxLength="3000" rows="4" /></label><div className="dialog-actions"><button className="quiet-button" type="button" onClick={() => setEditingVideo(null)}>Cancelar</button><button className="primary-button" type="submit"><Check size={16} /> Guardar cambios</button></div></form></section></div>}
    </div>
  )
}

export default App
