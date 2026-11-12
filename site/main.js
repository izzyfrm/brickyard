// Brickyard site: scroll reveals, nav glass, hero tilt, card spotlight, magnetic buttons, and the live demo.
;(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
  const $ = (s, el = document) => el.querySelector(s)

  /* Split the hero headline into words so they can arrive one by one */
  const h1 = $('h1')
  if (h1 && !reduced) {
    let w = 0
    const split = (node) => {
      for (const child of [...node.childNodes]) {
        if (child.nodeType === 3) {
          const frag = document.createDocumentFragment()
          for (const part of child.textContent.split(/(\s+)/)) {
            if (!part) continue
            if (/^\s+$/.test(part)) frag.append(part)
            else {
              const s = document.createElement('span')
              s.className = 'word'
              s.style.setProperty('--w', String(w++))
              s.textContent = part
              frag.append(s)
            }
          }
          child.replaceWith(frag)
        } else if (child.nodeType === 1 && child.tagName !== 'BR') split(child)
      }
    }
    split(h1)
    h1.classList.add('split')
  }

  /* Inertial scrolling: the wheel sets a target and the page glides to it.
     Only for mouse/trackpad users who have not asked for reduced motion; keyboard,
     touch and scrollbar dragging stay native. */
  if (!reduced && matchMedia('(pointer: fine)').matches) {
    document.documentElement.classList.add('inertia')
    let target = scrollY
    let current = scrollY
    let raf = 0
    const max = () => document.documentElement.scrollHeight - innerHeight
    const step = () => {
      current += (target - current) * 0.1
      if (Math.abs(target - current) < 0.5) current = target
      scrollTo(0, current)
      raf = current === target ? 0 : requestAnimationFrame(step)
    }
    const glide = (to) => {
      target = Math.max(0, Math.min(max(), to))
      if (!raf) {
        current = scrollY
        raf = requestAnimationFrame(step)
      }
    }
    addEventListener(
      'wheel',
      (e) => {
        if (e.ctrlKey || e.defaultPrevented) return // pinch-zoom
        // Let scrollable children (code, chat) keep their own wheel.
        for (let n = e.target; n && n !== document.body; n = n.parentElement) {
          if (n.scrollHeight > n.clientHeight + 1 && /(auto|scroll)/.test(getComputedStyle(n).overflowY)) return
        }
        e.preventDefault()
        const unit = e.deltaMode === 1 ? 40 : e.deltaMode === 2 ? innerHeight : 1
        glide((raf ? target : scrollY) + e.deltaY * unit)
      },
      { passive: false }
    )
    // Keep in sync with keyboard or scrollbar scrolling.
    addEventListener('scroll', () => {
      if (!raf) target = current = scrollY
    }, { passive: true })
    // Anchor links glide too, landing just under the fixed nav.
    document.querySelectorAll('a[href^="#"]').forEach((a) => {
      a.addEventListener('click', (e) => {
        const id = a.getAttribute('href')
        const el = id === '#top' ? document.body : document.querySelector(id)
        if (!el) return
        e.preventDefault()
        glide(id === '#top' ? 0 : el.getBoundingClientRect().top + scrollY - 90)
        history.replaceState(null, '', id)
      })
    })
  }

  /* Reveal on scroll */
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          e.target.classList.add('in')
          io.unobserve(e.target)
        }
      }
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.08 }
  )
  document.querySelectorAll('.reveal').forEach((el) => io.observe(el))

  /* Nav glass + hero parallax/tilt, batched into one frame */
  const nav = $('#nav')
  const win = $('.win')
  const root = document.documentElement
  let ticking = false
  const onScroll = () => {
    if (ticking) return
    ticking = true
    requestAnimationFrame(() => {
      const y = scrollY
      nav.classList.toggle('scrolled', y > 24)
      root.style.setProperty('--scroll', String(Math.min(y, 900)))
      if (win && !reduced) {
        // The demo window lies back and straightens as it scrolls into view.
        const r = win.getBoundingClientRect()
        const t = Math.max(0, Math.min(1, 1 - (r.top - innerHeight * 0.25) / (innerHeight * 0.55)))
        win.style.setProperty('--tilt', t.toFixed(3))
      }
      ticking = false
    })
  }
  addEventListener('scroll', onScroll, { passive: true })
  onScroll()

  /* Card spotlight follows the cursor */
  document.querySelectorAll('.card').forEach((card) => {
    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect()
      card.style.setProperty('--mx', `${e.clientX - r.left}px`)
      card.style.setProperty('--my', `${e.clientY - r.top}px`)
    })
  })

  /* Magnetic primary buttons */
  if (!reduced && matchMedia('(pointer: fine)').matches) {
    document.querySelectorAll('.magnetic').forEach((b) => {
      b.addEventListener('pointermove', (e) => {
        const r = b.getBoundingClientRect()
        const x = (e.clientX - r.left - r.width / 2) * 0.18
        const y = (e.clientY - r.top - r.height / 2) * 0.28
        b.style.transform = `translate(${x}px, ${y}px)`
      })
      b.addEventListener('pointerleave', () => (b.style.transform = ''))
    })
  }

  /* ------------------------------------------------------------- Demo */
  const chat = $('#chat')
  const typed = $('#typed')
  const send = $('#send')
  const title = $('#demo-title')
  if (!chat) return

  const PROMPT = 'Add a round system with an intermission and a winner screen'
  const REPLY = [
    'Done. I added ',
    '<code>RoundService</code>',
    ' in ServerScriptService: a 15 second intermission, a teleport to the map, and a winner banner sent to every client. ',
    'Codex checked the remotes and found nothing a client can abuse. ',
    'Press Play in Studio to try it.'
  ]
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  const el = (html, cls) => {
    const d = document.createElement('div')
    if (cls) d.className = cls
    d.innerHTML = html
    return d
  }
  const tool = (icon, name, arg, peer = false) =>
    el(`<img src="${icon}" alt="" class="${peer ? 'peer' : 'tint'}" /><b>${name}</b><span>${arg}</span><i class="spin"></i>`, 'tc pop')
  const done = (t) => {
    const s = t.querySelector('.spin')
    if (s) s.outerHTML = '<i class="check">✓</i>'
  }

  // Only animate while the demo is on screen; restart from the top each time.
  let visible = false
  let run = 0
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting
    if (visible) loop(++run)
  }, { threshold: 0.25 }).observe(chat)

  function finalState() {
    chat.innerHTML = ''
    title.textContent = PROMPT.slice(0, 46) + '…'
    chat.append(el(PROMPT, 'msg-user'))
    const a = el('<div class="msg-who"><img src="/logos/claude.svg" alt="" />CLAUDE</div>')
    const t1 = tool('/logos/studio.svg', 'Studio · script_search', '"Round"')
    const t2 = tool('/logos/codex.svg', 'Ask Codex', 'Review RoundService for exploits', true)
    done(t1)
    done(t2)
    a.append(t1, t2, el(REPLY.join(''), 'md'), el('18.4S · $0.21', 'meta'))
    chat.append(a)
  }

  async function loop(id) {
    if (reduced) return finalState()
    const alive = () => visible && id === run
    while (alive()) {
      chat.innerHTML = ''
      typed.textContent = ''
      title.textContent = 'New thread'
      send.classList.remove('ready')
      await sleep(900)

      for (const ch of PROMPT) {
        if (!alive()) return
        typed.textContent += ch
        send.classList.toggle('ready', true)
        await sleep(26 + Math.random() * 40)
      }
      await sleep(420)
      send.classList.add('press')
      await sleep(140)
      send.classList.remove('press', 'ready')
      typed.textContent = ''
      title.textContent = PROMPT.slice(0, 46) + '…'
      chat.append(el(PROMPT, 'msg-user pop'))
      await sleep(650)

      const a = el('<div class="msg-who"><img src="/logos/claude.svg" alt="" />CLAUDE</div>', 'pop')
      chat.append(a)
      await sleep(500)
      const t1 = tool('/logos/studio.svg', 'Studio · script_search', '"Round"')
      a.append(t1)
      await sleep(1300)
      if (!alive()) return
      done(t1)
      const t2 = tool('/logos/studio.svg', 'Studio · multi_edit', 'ServerScriptService.RoundService')
      a.append(t2)
      await sleep(1400)
      if (!alive()) return
      done(t2)
      const t3 = tool('/logos/codex.svg', 'Ask Codex', 'Review RoundService for exploits', true)
      a.append(t3)
      await sleep(1900)
      if (!alive()) return
      done(t3)

      const md = el('', 'md live pop')
      a.append(md)
      for (const chunk of REPLY) {
        if (chunk.startsWith('<')) {
          md.insertAdjacentHTML('beforeend', chunk)
          continue
        }
        for (const word of chunk.split(/(?<=\s)/)) {
          if (!alive()) return
          md.insertAdjacentText('beforeend', word)
          await sleep(38)
        }
      }
      md.classList.remove('live')
      a.append(el('18.4S · $0.21', 'meta pop'))
      await sleep(5200)
    }
  }
})()
