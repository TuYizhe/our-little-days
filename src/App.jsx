'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  CalendarDays, Camera, ChevronDown, Clock3, Cloud, CloudOff, CloudSun, Coffee, Copy, Edit3,
  Heart, HeartHandshake, Home, ImagePlus, Images, LockKeyhole, MapPin,
  Menu, MessageCircleHeart, MoreHorizontal, Music2, PartyPopper, Plus,
  Quote, RefreshCw, Search, ShieldCheck, Sparkles, Trash2, Utensils, X
} from 'lucide-react'
import { generateSyncCode, isCloudConfigured, pullSnapshot, pushSnapshot } from './cloudSync'

const starterEntries = [
  {
    id: 1, date: '2026-07-14', displayDate: '7月14日 · 星期二', time: '21:36', mood: '幸福', icon: 'heart',
    title: '晚风里的散步', text: '吃完饭沿着河边慢慢走了很久。你说今天的云像奶油，我说你笑起来更甜。没有特别的安排，但就是很喜欢这样普通的一天。',
    location: '滨江小路', color: 'peach', photos: []
  },
  {
    id: 2, date: '2026-07-12', displayDate: '7月12日 · 星期日', time: '15:08', mood: '甜蜜', icon: 'coffee',
    title: '躲进咖啡店的雨天', text: '突然下起大雨，我们挤在窗边的小桌，分享一块焦糖蛋糕。玻璃上的雨滴把街道变得模糊，而你就在我对面，清清楚楚。',
    location: '街角咖啡', color: 'cream', photos: []
  },
  {
    id: 3, date: '2026-07-09', displayDate: '7月9日 · 星期四', time: '19:42', mood: '开心', icon: 'food',
    title: '第一次一起做晚饭', text: '番茄炒蛋有一点咸，厨房也被我们弄得乱七八糟。可你认真切菜的样子，值得被我偷偷记很久。',
    location: '我们的小厨房', color: 'sage', photos: []
  }
]

const iconMap = {
  heart: MessageCircleHeart,
  coffee: Coffee,
  food: Utensils,
  music: Music2,
  sparkle: Sparkles
}

const moods = ['幸福', '甜蜜', '开心', '想念', '平静']

const starterAnniversaries = [
  { id: 1, date: '2026-05-20', title: '我们的纪念日', desc: '下一次，也要一起吃蛋糕', color: 'rose', icon: 'heart' },
  { id: 2, date: '2026-08-16', title: '她的生日', desc: '准备一份小小的惊喜', color: 'gold', icon: 'party' },
  { id: 3, date: '2026-12-31', title: '一起跨年', desc: '在零点交换新年愿望', color: 'sage', icon: 'calendar' },
]

function prettyDate(value) {
  const d = new Date(value + 'T12:00:00')
  const weekdays = ['星期日','星期一','星期二','星期三','星期四','星期五','星期六']
  return `${d.getMonth() + 1}月${d.getDate()}日 · ${weekdays[d.getDay()]}`
}

function App() {
  const [entries, setEntries] = useState(() => {
    if (typeof window === 'undefined') return starterEntries
    try { return JSON.parse(localStorage.getItem('little-days-entries')) || starterEntries }
    catch { return starterEntries }
  })
  const [modalOpen, setModalOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [activeFilter, setActiveFilter] = useState('全部')
  const [query, setQuery] = useState('')
  const [toast, setToast] = useState('')
  const [menuId, setMenuId] = useState(null)
  const [startModalOpen, setStartModalOpen] = useState(false)
  const [anniversaryModal, setAnniversaryModal] = useState(null)
  const [syncModalOpen, setSyncModalOpen] = useState(false)
  const [syncCode, setSyncCode] = useState(() => typeof window === 'undefined' ? '' : (localStorage.getItem('little-days-sync-code') || ''))
  const [syncStatus, setSyncStatus] = useState('off')
  const [syncError, setSyncError] = useState('')
  const [lastSyncedAt, setLastSyncedAt] = useState('')
  const snapshotRef = useRef(null)
  const cloudReadyRef = useRef(false)
  const skipNextCloudSaveRef = useRef(false)
  const lastRemoteUpdateRef = useRef('')
  const [relationshipStart, setRelationshipStart] = useState(() => {
    if (typeof window === 'undefined') return '2025-04-07'
    return localStorage.getItem('little-days-start') || '2025-04-07'
  })
  const [anniversaries, setAnniversaries] = useState(() => {
    if (typeof window === 'undefined') return starterAnniversaries
    try { return JSON.parse(localStorage.getItem('little-days-anniversaries')) || starterAnniversaries }
    catch { return starterAnniversaries }
  })

  useEffect(() => localStorage.setItem('little-days-entries', JSON.stringify(entries)), [entries])
  useEffect(() => localStorage.setItem('little-days-start', relationshipStart), [relationshipStart])
  useEffect(() => localStorage.setItem('little-days-anniversaries', JSON.stringify(anniversaries)), [anniversaries])

  const snapshot = useMemo(() => ({ entries, relationshipStart, anniversaries }), [entries, relationshipStart, anniversaries])
  snapshotRef.current = snapshot

  const applyCloudSnapshot = remote => {
    if (!remote || !Array.isArray(remote.entries) || !Array.isArray(remote.anniversaries) || typeof remote.relationshipStart !== 'string') {
      throw new Error('云端数据格式不正确')
    }
    skipNextCloudSaveRef.current = true
    setEntries(remote.entries)
    setRelationshipStart(remote.relationshipStart)
    setAnniversaries(remote.anniversaries)
  }

  const connectCloud = async (code, { createIfMissing = true, quiet = false } = {}) => {
    const value = code.trim()
    if (!value) throw new Error('请先输入情侣同步码')
    if (!isCloudConfigured()) throw new Error('云同步服务尚未完成配置')
    setSyncStatus('connecting')
    setSyncError('')
    try {
      const remote = await pullSnapshot(value)
      if (remote.exists) {
        applyCloudSnapshot(remote.snapshot)
        lastRemoteUpdateRef.current = remote.updatedAt || ''
      } else if (createIfMissing) {
        const saved = await pushSnapshot(value, snapshotRef.current)
        lastRemoteUpdateRef.current = saved.updatedAt
        skipNextCloudSaveRef.current = true
      } else {
        throw new Error('没有找到这个同步空间，请检查同步码')
      }
      localStorage.setItem('little-days-sync-code', remote.normalized)
      setSyncCode(remote.normalized)
      cloudReadyRef.current = true
      setSyncStatus('synced')
      setLastSyncedAt(new Date().toISOString())
      if (!quiet) {
        setToast(remote.exists ? '云端回忆已经同步到这台设备' : '情侣同步空间创建好啦')
        setTimeout(() => setToast(''), 2600)
      }
      return remote.normalized
    } catch (error) {
      cloudReadyRef.current = false
      setSyncStatus('error')
      setSyncError(error.message || '同步失败，请稍后再试')
      throw error
    }
  }

  const refreshCloud = async ({ quiet = false } = {}) => {
    if (!syncCode || !cloudReadyRef.current) return
    setSyncStatus('connecting')
    try {
      const remote = await pullSnapshot(syncCode)
      if (remote.exists && remote.updatedAt !== lastRemoteUpdateRef.current) {
        applyCloudSnapshot(remote.snapshot)
        lastRemoteUpdateRef.current = remote.updatedAt || ''
      }
      setSyncStatus('synced')
      setSyncError('')
      setLastSyncedAt(new Date().toISOString())
      if (!quiet) {
        setToast('已经是最新的回忆啦')
        setTimeout(() => setToast(''), 2200)
      }
    } catch (error) {
      setSyncStatus('error')
      setSyncError(error.message || '同步失败，请稍后再试')
    }
  }

  const disconnectCloud = () => {
    localStorage.removeItem('little-days-sync-code')
    cloudReadyRef.current = false
    lastRemoteUpdateRef.current = ''
    setSyncCode('')
    setSyncStatus('off')
    setSyncError('')
    setLastSyncedAt('')
    setToast('已退出云同步，本机内容仍然保留')
    setTimeout(() => setToast(''), 2400)
  }

  useEffect(() => {
    if (!syncCode || !isCloudConfigured()) return
    connectCloud(syncCode, { createIfMissing: false, quiet: true }).catch(() => {})
  }, [])

  useEffect(() => {
    if (!syncCode || !cloudReadyRef.current) return
    if (skipNextCloudSaveRef.current) {
      skipNextCloudSaveRef.current = false
      return
    }
    const timer = setTimeout(async () => {
      setSyncStatus('saving')
      try {
        const saved = await pushSnapshot(syncCode, snapshot)
        lastRemoteUpdateRef.current = saved.updatedAt
        setSyncStatus('synced')
        setSyncError('')
        setLastSyncedAt(new Date().toISOString())
      } catch (error) {
        setSyncStatus('error')
        setSyncError(error.message || '自动同步失败')
      }
    }, 1200)
    return () => clearTimeout(timer)
  }, [snapshot, syncCode])

  useEffect(() => {
    if (!syncCode) return
    const timer = setInterval(() => refreshCloud({ quiet: true }), 30000)
    const onFocus = () => refreshCloud({ quiet: true })
    window.addEventListener('focus', onFocus)
    return () => {
      clearInterval(timer)
      window.removeEventListener('focus', onFocus)
    }
  }, [syncCode])

  const daysTogether = Math.max(1, Math.floor((new Date() - new Date(`${relationshipStart}T00:00:00`)) / 86400000) + 1)
  const sinceLabel = relationshipStart.replaceAll('-', '.')
  const filtered = useMemo(() => entries.filter(entry => {
    const moodMatch = activeFilter === '全部' || entry.mood === activeFilter
    const searchMatch = !query || `${entry.title}${entry.text}${entry.location}`.toLowerCase().includes(query.toLowerCase())
    return moodMatch && searchMatch
  }), [entries, activeFilter, query])

  const addEntry = (entry) => {
    setEntries(current => [entry, ...current])
    setModalOpen(false)
    setToast('这一天，已经好好收藏啦')
    setTimeout(() => setToast(''), 2600)
    setTimeout(() => document.querySelector('#timeline')?.scrollIntoView({ behavior: 'smooth' }), 200)
  }

  const removeEntry = id => {
    setEntries(current => current.filter(item => item.id !== id))
    setMenuId(null)
    setToast('已从时光轴中移除')
    setTimeout(() => setToast(''), 2200)
  }

  const saveAnniversary = item => {
    setAnniversaries(current => item.id
      ? current.map(existing => existing.id === item.id ? item : existing)
      : [...current, { ...item, id: Date.now() }])
    setAnniversaryModal(null)
    setToast(item.id ? '纪念日已经更新' : '新的纪念日已经记住啦')
    setTimeout(() => setToast(''), 2400)
  }

  const removeAnniversary = id => {
    setAnniversaries(current => current.filter(item => item.id !== id))
    setToast('纪念日已删除')
    setTimeout(() => setToast(''), 2200)
  }

  return (
    <div className="app-shell">
      <div className="paper-noise" />
      <Header onAdd={() => setModalOpen(true)} onSync={() => setSyncModalOpen(true)} syncStatus={syncStatus} mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />

      <main>
        <section className="hero" id="home">
          <div className="hero-blob blob-one" />
          <div className="hero-blob blob-two" />
          <div className="hero-copy">
            <div className="eyebrow"><Sparkles size={14} /> 属于我们的秘密花园</div>
            <h1>把平凡的日子<br /><em>过成喜欢的样子</em></h1>
            <p className="hero-subtitle">日子很长，值得我们慢慢写。<br />今天的心动，也别忘了好好收藏。</p>
            <div className="hero-actions">
              <button className="primary-btn" onClick={() => setModalOpen(true)}><Edit3 size={17} /> 写下今天</button>
              <button className="text-btn" onClick={() => document.querySelector('#timeline').scrollIntoView({behavior:'smooth'})}>翻翻我们的故事 <ChevronDown size={16} /></button>
            </div>
          </div>

          <div className="hero-keepsake" aria-label="在一起的天数">
            <button className="edit-start-btn" onClick={() => setStartModalOpen(true)}><Edit3 size={13} /> 设置日期</button>
            <span className="tape tape-top" />
            <div className="polaroid-scene">
              <div className="sun-orb" /><div className="hill hill-one" /><div className="hill hill-two" />
              <div className="little-couple"><span className="person p-one" /><span className="person p-two" /><Heart className="tiny-heart" size={18} fill="currentColor" /></div>
              <span className="scene-note">有你在身边，每一天都很好</span>
            </div>
            <div className="keepsake-caption">
              <span>我们已经一起走过</span>
              <strong>{daysTogether.toLocaleString()} <small>天</small></strong>
              <span className="since">SINCE {sinceLabel}</span>
            </div>
            <span className="doodle-heart">♡</span>
          </div>

          <div className="today-card">
            <div><CloudSun size={21} /><span>今日 · 晴朗</span></div>
            <p>“想和你分享，每一个不起眼的瞬间。”</p>
          </div>
        </section>

        <section className="memory-strip" aria-label="回忆概览">
          <Stat icon={HeartHandshake} value={daysTogether} label="相伴日夜" />
          <span className="stat-divider" />
          <Stat icon={MessageCircleHeart} value={entries.length} label="心动记录" />
          <span className="stat-divider" />
          <Stat icon={Images} value={entries.reduce((n,e) => n + (e.photos?.length || 0), 0)} label="珍藏照片" />
          <span className="stat-divider" />
          <Stat icon={PartyPopper} value={anniversaries.length} label="重要纪念日" />
        </section>

        <section className="timeline-section" id="timeline">
          <SectionHeading kicker="OUR STORY" title="最近的小日子" subtitle="不必轰轰烈烈，认真记下的每一天，都在闪闪发光。" />
          <div className="timeline-toolbar">
            <div className="filters">
              {['全部', ...moods].map(filter => <button key={filter} className={activeFilter === filter ? 'active' : ''} onClick={() => setActiveFilter(filter)}>{filter}</button>)}
            </div>
            <label className="search-box"><Search size={16} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="找一段回忆…" /></label>
          </div>

          <div className="timeline-list">
            {filtered.length ? filtered.map((entry, index) => {
              const Icon = iconMap[entry.icon] || Heart
              return <article className="memory-entry" key={entry.id}>
                <div className="timeline-date"><span>{entry.displayDate || prettyDate(entry.date)}</span><small>{entry.time}</small></div>
                <div className="timeline-rail"><span className={`timeline-dot ${entry.color}`}><Icon size={17} /></span>{index < filtered.length - 1 && <i />}</div>
                <div className={`entry-card ${entry.color}`}>
                  <div className="entry-topline">
                    <span className="mood-pill"><Heart size={12} fill="currentColor" /> {entry.mood}</span>
                    <div className="entry-menu-wrap">
                      <button className="icon-btn" aria-label="更多操作" onClick={() => setMenuId(menuId === entry.id ? null : entry.id)}><MoreHorizontal size={19} /></button>
                      {menuId === entry.id && <button className="delete-pop" onClick={() => removeEntry(entry.id)}><Trash2 size={14} /> 删除记录</button>}
                    </div>
                  </div>
                  <h3>{entry.title}</h3>
                  <p>{entry.text}</p>
                  {entry.photos?.length > 0 && <div className="entry-photos">{entry.photos.map((src, i) => <img src={src} alt={`${entry.title} 照片 ${i+1}`} key={i} />)}</div>}
                  <footer><span><MapPin size={14} />{entry.location || '和你在一起'}</span><Quote size={17} /></footer>
                </div>
              </article>
            }) : <div className="empty-state"><Heart size={30} /><h3>还没找到这段回忆</h3><p>换个心情或关键词试试看吧。</p></div>}
          </div>
          <button className="add-memory-dashed" onClick={() => setModalOpen(true)}><Plus size={20} /><span>再记下一件小事</span></button>
        </section>

        <section className="photo-section" id="photos">
          <SectionHeading kicker="PHOTO ALBUM" title="一格一格的喜欢" subtitle="有些瞬间，照片比文字记得更清楚。" light />
          <div className="photo-collage">
            <PhotoTile className="tile-large tile-sunset" icon={Heart} label="黄昏散步" note="风也温柔" />
            <PhotoTile className="tile-coffee" icon={Coffee} label="雨天咖啡" note="一起躲雨" />
            <PhotoTile className="tile-flower" icon={Sparkles} label="路边的花" note="你说很好看" />
            <PhotoTile className="tile-kitchen" icon={Utensils} label="今日晚餐" note="两人份快乐" />
            <button className="upload-tile" onClick={() => setModalOpen(true)}><ImagePlus size={25} /><strong>添一张新照片</strong><span>把喜欢的瞬间放进来</span></button>
          </div>
        </section>

        <section className="anniversary-section" id="anniversary">
          <SectionHeading kicker="OUR MILESTONES" title="值得期待的日子" subtitle="每一次倒数，都因为要和你一起而变得浪漫。" />
          <div className="anniversary-actions"><button onClick={() => setAnniversaryModal({})}><Plus size={16} /> 添加纪念日</button></div>
          <div className="anniversary-grid">
            {anniversaries.map(item => <Anniversary key={item.id} item={item} onEdit={() => setAnniversaryModal(item)} onDelete={() => removeAnniversary(item.id)} />)}
            {!anniversaries.length && <button className="empty-anniversary" onClick={() => setAnniversaryModal({})}><CalendarDays size={28} /><strong>还没有纪念日</strong><span>点这里添加第一个重要日子</span></button>}
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="footer-mark"><Heart size={16} fill="currentColor" /> 我们的小日子</div>
        <p>愿以后每一个寻常日子，都有花、有笑、有你。</p>
        <span>{syncCode ? <Cloud size={13} /> : <LockKeyhole size={13} />} {syncCode ? '已使用情侣同步码加密同步' : '仅保存在你的浏览器中'}</span>
      </footer>

      {modalOpen && <EntryModal onClose={() => setModalOpen(false)} onSave={addEntry} />}
      {startModalOpen && <StartDateModal value={relationshipStart} onClose={() => setStartModalOpen(false)} onSave={value => { setRelationshipStart(value); setStartModalOpen(false); setToast('在一起的日期设置好啦'); setTimeout(() => setToast(''), 2200) }} />}
      {anniversaryModal && <AnniversaryModal item={anniversaryModal} onClose={() => setAnniversaryModal(null)} onSave={saveAnniversary} />}
      {syncModalOpen && <SyncModal
        configured={isCloudConfigured()}
        connectedCode={syncCode}
        status={syncStatus}
        error={syncError}
        lastSyncedAt={lastSyncedAt}
        onClose={() => setSyncModalOpen(false)}
        onConnect={connectCloud}
        onRefresh={() => refreshCloud()}
        onDisconnect={disconnectCloud}
      />}
      {toast && <div className="toast"><Heart size={15} fill="currentColor" /> {toast}</div>}
    </div>
  )
}

function Header({ onAdd, onSync, syncStatus, mobileOpen, setMobileOpen }) {
  const links = [['首页','home'],['时光轴','timeline'],['照片墙','photos'],['纪念日','anniversary']]
  const go = id => { document.querySelector(`#${id}`).scrollIntoView({behavior:'smooth'}); setMobileOpen(false) }
  return <header className="site-header">
    <button className="brand" onClick={() => go('home')}><span><Heart size={16} fill="currentColor" /></span><strong>我们的小日子</strong></button>
    <nav className={mobileOpen ? 'open' : ''}>{links.map(([label,id]) => <button onClick={() => go(id)} key={id}>{label}</button>)}</nav>
    <div className="header-actions">
      <button className={`header-sync ${syncStatus}`} onClick={onSync} title="情侣云同步">
        {syncStatus === 'off' || syncStatus === 'error' ? <CloudOff size={16} /> : <Cloud size={16} />}
        <span>{syncStatus === 'saving' ? '同步中' : syncStatus === 'synced' ? '已同步' : '云同步'}</span>
      </button>
      <button className="header-add" onClick={onAdd}><Plus size={16} /> 记录今天</button>
    </div>
    <button className="mobile-menu" onClick={() => setMobileOpen(!mobileOpen)} aria-label="打开菜单">{mobileOpen ? <X /> : <Menu />}</button>
  </header>
}

function Stat({ icon: Icon, value, label }) {
  return <div className="stat"><span><Icon size={20} /></span><div><strong>{value}</strong><small>{label}</small></div></div>
}

function SectionHeading({ kicker, title, subtitle, light = false }) {
  return <div className={`section-heading ${light ? 'light' : ''}`}><span>{kicker}</span><h2>{title}</h2><p>{subtitle}</p></div>
}

function PhotoTile({ className, icon: Icon, label, note }) {
  return <div className={`photo-tile ${className}`}><div className="photo-illustration"><Icon /></div><div className="photo-label"><strong>{label}</strong><span>{note}</span></div></div>
}

function Anniversary({ item, onEdit, onDelete }) {
  const Icon = item.icon === 'party' ? PartyPopper : item.icon === 'calendar' ? CalendarDays : Heart
  const month = item.date.slice(5).replace('-', '.')
  const today = new Date()
  let next = new Date(`${today.getFullYear()}-${item.date.slice(5)}T00:00:00`)
  if (next < new Date(today.getFullYear(), today.getMonth(), today.getDate())) next.setFullYear(next.getFullYear() + 1)
  const countdown = Math.max(0, Math.ceil((next - new Date(today.getFullYear(), today.getMonth(), today.getDate())) / 86400000))
  return <div className={`anniversary-card ${item.color}`}>
    <div className="anniversary-card-actions"><button onClick={onEdit} aria-label="编辑纪念日"><Edit3 size={14} /></button><button onClick={onDelete} aria-label="删除纪念日"><Trash2 size={14} /></button></div>
    <span className="anniversary-icon"><Icon size={20} /></span><div className="date-stamp">{month}</div><h3>{item.title}</h3><p>{item.desc || '这是属于我们的特别日子'}</p><span className="tiny-note">{countdown === 0 ? '就是今天 ♡' : `还有 ${countdown} 天 ♡`}</span>
  </div>
}

function StartDateModal({ value, onClose, onSave }) {
  const [date, setDate] = useState(value)
  return <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose()}>
    <form className="entry-modal compact-modal" onSubmit={e => { e.preventDefault(); onSave(date) }}>
      <button type="button" className="modal-close" onClick={onClose}><X size={20} /></button>
      <div className="modal-heading"><span><HeartHandshake size={18} /></span><div><h2>设置在一起的日期</h2><p>天数会从这一天开始自动计算。</p></div></div>
      <label>我们从哪一天开始？<input type="date" value={date} max={new Date().toISOString().slice(0,10)} onChange={e => setDate(e.target.value)} required /></label>
      <div className="modal-actions"><button type="button" className="cancel-btn" onClick={onClose}>取消</button><button className="save-btn" type="submit"><Heart size={16} fill="currentColor" /> 保存日期</button></div>
    </form>
  </div>
}

function AnniversaryModal({ item, onClose, onSave }) {
  const [date, setDate] = useState(item.date || new Date().toISOString().slice(0,10))
  const [title, setTitle] = useState(item.title || '')
  const [desc, setDesc] = useState(item.desc || '')
  const [color, setColor] = useState(item.color || 'rose')
  const [icon, setIcon] = useState(item.icon || 'heart')
  return <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose()}>
    <form className="entry-modal compact-modal" onSubmit={e => { e.preventDefault(); onSave({ ...item, date, title: title.trim(), desc: desc.trim(), color, icon }) }}>
      <button type="button" className="modal-close" onClick={onClose}><X size={20} /></button>
      <div className="modal-heading"><span><CalendarDays size={18} /></span><div><h2>{item.id ? '编辑纪念日' : '添加纪念日'}</h2><p>把每一个值得期待的日子记下来。</p></div></div>
      <label>纪念日名称<input value={title} onChange={e => setTitle(e.target.value)} placeholder="例如：第一次约会" maxLength={24} required /></label>
      <label>日期<input type="date" value={date} onChange={e => setDate(e.target.value)} required /></label>
      <label>想写的话<input value={desc} onChange={e => setDesc(e.target.value)} placeholder="例如：每年都要一起庆祝" maxLength={42} /></label>
      <div className="form-row anniversary-options">
        <label>图标<div className="option-selector">{[['heart',Heart],['party',PartyPopper],['calendar',CalendarDays]].map(([key,Icon]) => <button type="button" key={key} className={icon === key ? 'selected' : ''} onClick={() => setIcon(key)}><Icon size={17} /></button>)}</div></label>
        <label>颜色<div className="option-selector color-options">{['rose','gold','sage'].map(key => <button type="button" aria-label={key} key={key} className={`${key} ${color === key ? 'selected' : ''}`} onClick={() => setColor(key)} />)}</div></label>
      </div>
      <div className="modal-actions"><button type="button" className="cancel-btn" onClick={onClose}>取消</button><button className="save-btn" type="submit"><Heart size={16} fill="currentColor" /> {item.id ? '保存修改' : '添加纪念日'}</button></div>
    </form>
  </div>
}

function formatSyncCode(value) {
  return value.replace(/[^A-Z0-9]/gi, '').match(/.{1,5}/g)?.join('-') || value
}

function SyncModal({ configured, connectedCode, status, error, lastSyncedAt, onClose, onConnect, onRefresh, onDisconnect }) {
  const [code, setCode] = useState(connectedCode ? formatSyncCode(connectedCode) : '')
  const [copied, setCopied] = useState(false)
  const isWorking = status === 'connecting' || status === 'saving'

  const copyCode = async () => {
    await navigator.clipboard.writeText(formatSyncCode(connectedCode || code))
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  const createCode = () => {
    const next = generateSyncCode()
    setCode(next)
    setCopied(false)
  }

  const connect = async event => {
    event.preventDefault()
    try {
      await onConnect(code, { createIfMissing: true })
    } catch {
      // 错误信息由主界面统一展示。
    }
  }

  return <div className="modal-backdrop" onMouseDown={event => event.target === event.currentTarget && onClose()}>
    <form className="entry-modal compact-modal sync-modal" onSubmit={connect}>
      <button type="button" className="modal-close" onClick={onClose}><X size={20} /></button>
      <div className="modal-heading"><span><Cloud size={18} /></span><div><h2>情侣加密同步</h2><p>两台设备输入同一个同步码，就能看到相同的回忆。</p></div></div>

      {!configured && <div className="sync-setup-notice">
        <CloudOff size={22} />
        <div><strong>云端服务还差最后一步</strong><p>网页功能已经接好，配置好云数据库后这里会自动启用。</p></div>
      </div>}

      {configured && connectedCode ? <>
        <div className="sync-connected-card">
          <span className="sync-shield"><ShieldCheck size={23} /></span>
          <div><small>{status === 'saving' ? '正在保存到云端…' : status === 'connecting' ? '正在检查新内容…' : '这台设备已连接'}</small><strong>{formatSyncCode(connectedCode)}</strong></div>
          <button type="button" onClick={copyCode}><Copy size={15} /> {copied ? '已复制' : '复制'}</button>
        </div>
        <div className="sync-explainer"><LockKeyhole size={16} /><p>照片和文字会先在这台设备上加密，再传到云端。请只把同步码告诉你的另一半。</p></div>
        {lastSyncedAt && <p className="last-synced">最近同步：{new Date(lastSyncedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</p>}
        {error && <p className="sync-error">{error}</p>}
        <div className="modal-actions sync-actions">
          <button type="button" className="danger-text-btn" onClick={onDisconnect}>退出同步</button>
          <button type="button" className="save-btn" disabled={isWorking} onClick={onRefresh}><RefreshCw size={15} className={isWorking ? 'spin' : ''} /> 立即同步</button>
        </div>
      </> : <>
        <label>情侣同步码
          <div className="sync-code-input">
            <input value={code} onChange={event => setCode(event.target.value.toUpperCase())} placeholder="输入另一台设备的同步码" autoComplete="off" disabled={!configured} />
            <button type="button" onClick={createCode} disabled={!configured}>生成新码</button>
          </div>
        </label>
        <div className="sync-explainer"><ShieldCheck size={16} /><p>第一次使用请点“生成新码”，连接成功后复制给另一台设备。同步码无法找回，请妥善保存。</p></div>
        {error && <p className="sync-error">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="cancel-btn" onClick={onClose}>暂不开启</button>
          <button className="save-btn" type="submit" disabled={!configured || isWorking || !code.trim()}><Cloud size={16} /> {isWorking ? '正在连接…' : '连接并同步'}</button>
        </div>
      </>}
    </form>
  </div>
}

function EntryModal({ onClose, onSave }) {
  const [date, setDate] = useState(new Date().toISOString().slice(0,10))
  const [title, setTitle] = useState('')
  const [text, setText] = useState('')
  const [location, setLocation] = useState('')
  const [mood, setMood] = useState('幸福')
  const [photos, setPhotos] = useState([])
  const fileRef = useRef(null)

  const handlePhotos = async event => {
    const room = Math.max(0, 3 - photos.length)
    const files = Array.from(event.target.files).slice(0, room)
    const results = await Promise.allSettled(files.map(compressPhoto))
    const compressed = results.filter(result => result.status === 'fulfilled').map(result => result.value)
    setPhotos(current => [...current, ...compressed].slice(0, 3))
    event.target.value = ''
  }
  const submit = e => {
    e.preventDefault()
    if (!title.trim() || !text.trim()) return
    const now = new Date()
    onSave({ id: Date.now(), date, displayDate: prettyDate(date), time: now.toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'}), mood, icon: mood === '甜蜜' ? 'heart' : mood === '平静' ? 'coffee' : 'sparkle', title: title.trim(), text: text.trim(), location: location.trim(), color: ['peach','cream','sage'][entriesHash(title) % 3], photos })
  }
  return <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose()}>
    <form className="entry-modal" onSubmit={submit}>
      <button type="button" className="modal-close" onClick={onClose}><X size={20} /></button>
      <div className="modal-heading"><span><Edit3 size={18} /></span><div><h2>写下今天</h2><p>把值得记住的小事，好好放在这里。</p></div></div>
      <label>今天是什么日子？<input type="date" value={date} onChange={e => setDate(e.target.value)} /></label>
      <label>给这一天起个名字<input value={title} onChange={e => setTitle(e.target.value)} placeholder="例如：晚风里的散步" maxLength={32} required /></label>
      <label>今天发生了什么？<textarea value={text} onChange={e => setText(e.target.value)} placeholder="慢慢写，不着急……" rows={5} maxLength={400} required /><small>{text.length}/400</small></label>
      <div className="form-row">
        <label>今天的心情<div className="mood-selector">{moods.map(item => <button type="button" key={item} className={mood === item ? 'selected' : ''} onClick={() => setMood(item)}>{item}</button>)}</div></label>
        <label>在哪里？<div className="input-with-icon"><MapPin size={15} /><input value={location} onChange={e => setLocation(e.target.value)} placeholder="可选" /></div></label>
      </div>
      <label>放几张照片 <span className="optional">最多 3 张</span>
        <div className="photo-picker">
          {photos.map((src,i) => <div className="photo-preview" key={i}><img src={src} alt="预览" /><button type="button" onClick={() => setPhotos(p => p.filter((_,j) => i !== j))}><X size={13} /></button></div>)}
          {photos.length < 3 && <button type="button" className="pick-photo" onClick={() => fileRef.current.click()}><Camera size={20} /><span>添加照片</span></button>}
          <input ref={fileRef} hidden type="file" accept="image/*" multiple onChange={handlePhotos} />
        </div>
      </label>
      <div className="modal-actions"><button type="button" className="cancel-btn" onClick={onClose}>晚点再写</button><button className="save-btn" type="submit"><Heart size={16} fill="currentColor" /> 收藏这一天</button></div>
    </form>
  </div>
}

function entriesHash(str) { return [...str].reduce((sum,c) => sum + c.charCodeAt(0), 0) }

function compressPhoto(file) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    const objectUrl = URL.createObjectURL(file)
    image.onload = () => {
      const maxSide = 1100
      const scale = Math.min(1, maxSide / Math.max(image.width, image.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(image.width * scale))
      canvas.height = Math.max(1, Math.round(image.height * scale))
      const context = canvas.getContext('2d')
      context.drawImage(image, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(objectUrl)
      resolve(canvas.toDataURL('image/jpeg', 0.76))
    }
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('照片读取失败'))
    }
    image.src = objectUrl
  })
}

export default App
