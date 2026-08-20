/* ============================================================================
 * DSH Background Image Plugin
 * ============================================================================
 * A Cordis dynamic plugin that customizes the DSH GUI background.
 *
 * Features:
 *   - 7 image sources (anime, landscape, photography, custom URL, local upload)
 *   - Image opacity and blur controls (real-time)
 *   - Manual refresh + auto-refresh timer
 *   - All settings persisted to localStorage (survives DSH restart)
 *   - Background auto-restored on DSH startup
 *
 * Installation:
 *   dsh plugin --profile <name> add dsh-bg-image
 *
 * Usage:
 *   Open Settings → Background in the DSH WebUI
 * ========================================================================== */

return {
  inject: ['timer'],
  apply(ctx) {
    var slots = ctx.get('slots')
    if (!slots) return
    var timer = ctx.timer

    // --------------------------------------------------------------------------
    // Persistence
    // --------------------------------------------------------------------------
    var STORAGE_KEY = 'dsh-bg-image-settings'
    function loadSettings() { try { var r = localStorage.getItem(STORAGE_KEY); return r ? JSON.parse(r) : null } catch (e) { return null } }
    function saveSettings(s) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)) } catch (e) {} }

    // --------------------------------------------------------------------------
    // i18n
    // --------------------------------------------------------------------------
    var I18N = {
      zh: { title: '背景', source: '图源', opacity: '不透明度', blur: '模糊', autoRefresh: '自动刷新', interval: '刷新间隔', refreshNow: '立即刷新', clear: '清除', current: '当前背景', customPlaceholder: 'https://example.com/image.jpg', enterUrl: '请输入图片URL', uploadBtn: '选择图片', lang: 'English' },
      en: { title: 'Background', source: 'Source', opacity: 'Opacity', blur: 'Blur', autoRefresh: 'Auto-Refresh', interval: 'Interval', refreshNow: 'Refresh Now', clear: 'Clear', current: 'Current', customPlaceholder: 'https://example.com/image.jpg', enterUrl: 'Please enter an image URL', uploadBtn: 'Choose Image', lang: '中文' }
    }

    // --------------------------------------------------------------------------
    // Image sources
    // --------------------------------------------------------------------------
    var SOURCE_NAMES = {
      anime_pc: { zh: '动漫横屏', en: 'Anime Wallpaper' },
      anime_illust: { zh: '二次元插画', en: 'Anime Illustration' },
      scenery_photo: { zh: '随机摄影', en: 'Photography' },
      wallpaper_bing: { zh: 'Bing 每日', en: 'Bing Daily' },
      wallpaper_art: { zh: '艺术壁纸', en: 'Art Wallpaper' },
      custom_url: { zh: '自定义链接', en: 'Custom URL' },
      local_upload: { zh: '本地上传', en: 'Upload' }
    }

    var SOURCE_URLS = {
      anime_pc: 'https://www.loliapi.com/acg/pc/',
      anime_illust: 'https://api.yujn.cn/api/ecy.php',
      scenery_photo: 'https://picsum.photos/1920/1080',
      wallpaper_bing: 'https://api.yujn.cn/api/bing.php',
      wallpaper_art: 'https://api.yujn.cn/api/heisi.php'
    }

    var SOURCE_KEYS = Object.keys(SOURCE_NAMES)
    var bgEl = null

    // --------------------------------------------------------------------------
    // Background DOM element management
    // --------------------------------------------------------------------------
    function ensureBgEl() {
      if (bgEl && document.body.contains(bgEl)) return bgEl
      bgEl = document.createElement('div')
      bgEl.id = 'dsh-bg-image-layer'
      bgEl.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:1;pointer-events:none;background-size:cover;background-position:center;background-repeat:no-repeat;'
      if (document.body && document.body.firstChild) {
        document.body.insertBefore(bgEl, document.body.firstChild)
      } else if (document.body) {
        document.body.appendChild(bgEl)
      }
      return bgEl
    }

    function applyBg(url, opacity, blur) {
      var el = ensureBgEl()
      el.style.backgroundImage = 'url("' + String(url).replace(/"/g, '%22') + '")'
      el.style.opacity = String(opacity)
      el.style.filter = 'blur(' + Math.round(parseInt(blur)) + 'px)'
      el.style.display = 'block'
    }

    // --------------------------------------------------------------------------
    // IndexedDB for local image storage (handles large DataURLs)
    // --------------------------------------------------------------------------
    var DB_NAME = 'dsh-bg-image-db'
    var DB_STORE = 'images'
    var DB_VERSION = 1

    function openDB() {
      return new Promise(function(resolve, reject) {
        var req = indexedDB.open(DB_NAME, DB_VERSION)
        req.onupgradeneeded = function() { req.result.createObjectStore(DB_STORE) }
        req.onsuccess = function() { resolve(req.result) }
        req.onerror = function() { reject(req.error) }
      })
    }

    function idbPut(key, value) {
      return openDB().then(function(db) {
        return new Promise(function(resolve, reject) {
          var tx = db.transaction(DB_STORE, 'readwrite')
          tx.objectStore(DB_STORE).put(value, key)
          tx.oncomplete = function() { db.close(); resolve() }
          tx.onerror = function() { db.close(); reject(tx.error) }
        })
      })
    }

    function idbGet(key) {
      return openDB().then(function(db) {
        return new Promise(function(resolve, reject) {
          var tx = db.transaction(DB_STORE, 'readonly')
          var req = tx.objectStore(DB_STORE).get(key)
          req.onsuccess = function() { db.close(); resolve(req.result) }
          req.onerror = function() { db.close(); reject(req.error) }
        })
      })
    }

    function idbDelete(key) {
      return openDB().then(function(db) {
        return new Promise(function(resolve, reject) {
          var tx = db.transaction(DB_STORE, 'readwrite')
          tx.objectStore(DB_STORE).delete(key)
          tx.oncomplete = function() { db.close(); resolve() }
          tx.onerror = function() { db.close(); reject(tx.error) }
        })
      })
    }

    function formatDuration(s) { if (s < 60) return s + 's'; var m = Math.floor(s / 60); if (m < 60) return m + 'm'; return Math.floor(m / 60) + 'h' }

    // --------------------------------------------------------------------------
    // Local image preview component (retrieves DataURL from IndexedDB)
    // --------------------------------------------------------------------------
    function LocalImagePreview(props) {
      var img = props.image
      var _R = React
      var url = img.url
      // For local images (stored as IndexedDB key), retrieve the DataURL
      if (url && url.startsWith('local-')) {
        var dataUrlSt = _R.useState(null)
        var dataUrl = dataUrlSt[0]
        _R.useEffect(function() {
          idbGet(url).then(function(d) { if (d) dataUrlSt[1](d) })
        }, [url])
        if (!dataUrl) return _R.createElement('div', { style: { width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--dsw-alias-label-secondary, #6b7280)', fontSize: '12px' } }, 'Loading...')
        return _R.createElement('img', { src: dataUrl, alt: '', style: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' }, onError: function(e) { e.target.style.display = 'none' } })
      }
      // For remote images, use URL directly
      return _R.createElement('img', { src: url, alt: '', style: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' }, onError: function(e) { e.target.style.display = 'none' } })
    }

    // --------------------------------------------------------------------------
    // Settings Panel Component
    // --------------------------------------------------------------------------
    function BeautifyPanel(props) {
      var _R = React
      // Re-read from localStorage on every mount to get latest settings
      var current = loadSettings()
      var langSt = _R.useState(current ? current.lang : 'zh')
      var lang = langSt[0], setLang = langSt[1]
      var sourceTypeSt = _R.useState(current ? current.sourceType : 'anime_pc')
      var sourceType = sourceTypeSt[0], setSourceType = sourceTypeSt[1]
      var customUrlSt = _R.useState(current ? (current.customUrl || '') : '')
      var customUrl = customUrlSt[0], setCustomUrl = customUrlSt[1]
      var opacitySt = _R.useState(current ? (current.opacity || 0.35) : 0.35)
      var opacity = opacitySt[0], setOpacity = opacitySt[1]
      var blurSt = _R.useState(current ? (current.blur || 0) : 0)
      var blur = blurSt[0], setBlur = blurSt[1]
      var autoRefreshSt = _R.useState(current ? (current.autoRefresh || false) : false)
      var autoRefresh = autoRefreshSt[0], setAutoRefresh = autoRefreshSt[1]
      var refreshIntervalSt = _R.useState(current ? (current.refreshInterval || 60) : 60)
      var refreshInterval = refreshIntervalSt[0], setRefreshInterval = refreshIntervalSt[1]
      var currentImageSt = _R.useState(current ? (current.currentImage || null) : null)
      var currentImage = currentImageSt[0], setCurrentImage = currentImageSt[1]
      var localFileNameSt = _R.useState(current ? (current.localFileName || null) : null)
      var localFileName = localFileNameSt[0], setLocalFileName = localFileNameSt[1]
      var localDataUrlSt = _R.useState(current ? (current.localDataUrl || null) : null)
      var localDataUrl = localDataUrlSt[0], setLocalDataUrl = localDataUrlSt[1]
      var fileInputRef = _R.useRef(null)

      // Persist on EVERY change
      _R.useEffect(function() {
        saveSettings({ lang, sourceType, customUrl, opacity, blur, autoRefresh, refreshInterval, currentImage, localFileName, localDataUrl })
      }, [lang, sourceType, customUrl, opacity, blur, autoRefresh, refreshInterval, currentImage, localFileName, localDataUrl])

      // Apply background when image/opacity/blur changes
      _R.useEffect(function() {
        if (currentImage && currentImage.url) applyBg(currentImage.url, opacity, blur)
      }, [currentImage ? currentImage.url : null, opacity, blur])

      // Auto-refresh timer
      _R.useEffect(function() {
        if (autoRefresh) return timer.interval(function() { doRefresh() }, refreshInterval * 1000)
      }, [autoRefresh, refreshInterval])

      function doRefresh() {
        if (sourceType === 'custom_url') {
          if (!customUrl.trim()) return
          var img = { url: customUrl.trim(), source: SOURCE_NAMES.custom_url[lang] }
          setCurrentImage(img)
          applyBg(img.url, opacity, blur)
          return
        }
        if (sourceType === 'local_upload') {
          if (localDataUrl) {
            // Retrieve actual DataURL from IndexedDB if it's a key
            if (localDataUrl.startsWith('local-')) {
              idbGet(localDataUrl).then(function(dataUrl) {
                if (dataUrl) {
                  var img = { url: localDataUrl, source: localFileName || SOURCE_NAMES.local_upload[lang], isLocal: true }
                  setCurrentImage(img)
                  applyBg(dataUrl, opacity, blur)
                }
              })
            } else {
              var img = { url: localDataUrl, source: localFileName || SOURCE_NAMES.local_upload[lang], isLocal: false }
              setCurrentImage(img)
              applyBg(localDataUrl, opacity, blur)
            }
          } else if (fileInputRef.current) {
            fileInputRef.current.click()
          }
          return
        }
        var baseUrl = SOURCE_URLS[sourceType]
        if (baseUrl) {
          var sep = baseUrl.indexOf('?') >= 0 ? '&' : '?'
          var img = { url: baseUrl + sep + '_t=' + Date.now(), source: SOURCE_NAMES[sourceType][lang] }
          setCurrentImage(img)
          applyBg(img.url, opacity, blur)
        }
      }

      function handleFileChange(e) {
        var f = e.target.files && e.target.files[0]
        if (!f) return
        setLocalFileName(f.name)
        var r = new FileReader()
        r.onload = function(ev) {
          var dataUrl = ev.target.result
          var imgKey = 'local-' + Date.now()
          // Store large DataURL in IndexedDB, keep only key in localStorage
          idbPut(imgKey, dataUrl).then(function() {
            setLocalDataUrl(imgKey)
            var img = { url: imgKey, source: f.name, isLocal: true }
            setCurrentImage(img)
            applyBg(dataUrl, opacity, blur)
          }).catch(function() {
            // Fallback: use DataURL directly if IndexedDB fails
            setLocalDataUrl(dataUrl)
            var img = { url: dataUrl, source: f.name, isLocal: false }
            setCurrentImage(img)
            applyBg(dataUrl, opacity, blur)
          })
        }
        r.readAsDataURL(f)
      }

      var prevBgRef = _R.useRef({ url: null, opacity: null, blur: null })
      _R.useEffect(function() {
        if (currentImage && currentImage.url) {
          var prev = prevBgRef.current
          if (prev.url !== currentImage.url || prev.opacity !== opacity || prev.blur !== blur) {
            // For local images, retrieve DataURL from IndexedDB
            if (currentImage.url.startsWith('local-')) {
              idbGet(currentImage.url).then(function(dataUrl) {
                if (dataUrl) {
                  applyBg(dataUrl, opacity, blur)
                  prevBgRef.current = { url: currentImage.url, opacity: opacity, blur: blur }
                }
              })
            } else {
              applyBg(currentImage.url, opacity, blur)
              prevBgRef.current = { url: currentImage.url, opacity: opacity, blur: blur }
            }
          }
        }
      })

      var cp = 'var(--dsw-alias-brand-primary, #6366f1)'
      var cb = 'var(--dsw-alias-border-l1, #d1d5db)'
      var cl = 'var(--dsw-alias-label-primary, #111827)'
      var cs = 'var(--dsw-alias-label-secondary, #6b7280)'
      var st = { fontSize: '11px', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: cs, margin: '0 0 10px 0' }
      var t = I18N[lang]

      var sourceList = _R.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: '2px' } }, SOURCE_KEYS.map(function(key) { var sel = sourceType === key; return _R.createElement('label', { key: key, onClick: function() { setSourceType(key) }, style: { display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', background: sel ? 'color-mix(in srgb, ' + cp + ' 8%, transparent)' : 'transparent', transition: 'background 150ms ease' } }, _R.createElement('span', { style: { width: '16px', height: '16px', borderRadius: '50%', border: '1.5px solid ' + (sel ? cp : cb), background: sel ? cp : 'transparent', flexShrink: 0, transition: 'all 150ms ease', display: 'flex', alignItems: 'center', justifyContent: 'center' } }, sel ? _R.createElement('span', { style: { width: '6px', height: '6px', borderRadius: '50%', background: '#fff' } }) : null), _R.createElement('span', { style: { fontSize: '13px', fontWeight: sel ? 500 : 400, color: sel ? cl : cs, transition: 'color 150ms ease' } }, SOURCE_NAMES[key][lang])) }))
      var customInput = sourceType === 'custom_url' ? _R.createElement('div', { style: { marginTop: '10px', paddingLeft: '26px' } }, _R.createElement('input', { type: 'text', value: customUrl, onChange: function(e) { setCustomUrl(e.target.value) }, placeholder: t.customPlaceholder, style: { width: '100%', padding: '8px 12px', border: '1px solid ' + cb, borderRadius: '6px', background: 'var(--dsw-alias-bg-layer-1, #fff)', color: cl, fontSize: '13px', boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit' } })) : null
      var uploadArea = sourceType === 'local_upload' ? _R.createElement('div', { style: { marginTop: '10px', paddingLeft: '26px' } }, _R.createElement('input', { ref: fileInputRef, type: 'file', accept: 'image/*', onChange: handleFileChange, style: { display: 'none' } }), _R.createElement('button', { onClick: function() { if (fileInputRef.current) fileInputRef.current.click() }, style: { width: '100%', padding: '10px 12px', border: '1px dashed ' + cb, borderRadius: '6px', background: 'var(--dsw-alias-bg-layer-2, #f3f4f6)', color: cs, fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' } }, localFileName || t.uploadBtn)) : null
      var opacityRow = _R.createElement('div', { style: { marginTop: '24px' } }, _R.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px' } }, _R.createElement('span', { style: st }, t.opacity), _R.createElement('span', { style: { fontSize: '12px', fontVariantNumeric: 'tabular-nums', color: cs, fontWeight: 500 } }, Math.round(opacity * 100) + '%')), _R.createElement('input', { type: 'range', min: '0.05', max: '1', step: '0.05', value: opacity, onChange: function(e) { setOpacity(parseFloat(e.target.value)) }, style: { width: '100%', accentColor: cp } }))
      var blurRow = _R.createElement('div', { style: { marginTop: '24px' } }, _R.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px' } }, _R.createElement('span', { style: st }, t.blur), _R.createElement('span', { style: { fontSize: '12px', fontVariantNumeric: 'tabular-nums', color: cs, fontWeight: 500 } }, blur + 'px')), _R.createElement('input', { type: 'range', min: '0', max: '30', step: '1', value: blur, onChange: function(e) { setBlur(parseInt(e.target.value)) }, style: { width: '100%', accentColor: cp } }))
      var refreshRow = _R.createElement('div', { style: { marginTop: '24px' } }, _R.createElement('label', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', padding: '4px 0' } }, _R.createElement('span', { style: st }, t.autoRefresh), _R.createElement('span', { onClick: function(e) { e.stopPropagation(); setAutoRefresh(!autoRefresh) }, style: { width: '32px', height: '18px', borderRadius: '9px', background: autoRefresh ? cp : cb, position: 'relative', cursor: 'pointer', transition: 'background 200ms ease', flexShrink: 0 } }, _R.createElement('span', { style: { position: 'absolute', top: '2px', left: autoRefresh ? '16px' : '2px', width: '14px', height: '14px', borderRadius: '50%', background: '#fff', boxShadow: '0 1px 2px rgba(0,0,0,0.15)', transition: 'left 200ms cubic-bezier(0.4, 0, 0.2, 1)' } }))), autoRefresh ? _R.createElement('div', { style: { marginTop: '12px' } }, _R.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px' } }, _R.createElement('span', { style: st }, t.interval), _R.createElement('span', { style: { fontSize: '12px', fontVariantNumeric: 'tabular-nums', color: cs, fontWeight: 500 } }, formatDuration(refreshInterval))), _R.createElement('input', { type: 'range', min: '10', max: '3600', step: '10', value: refreshInterval, onChange: function(e) { setRefreshInterval(parseInt(e.target.value)) }, style: { width: '100%', accentColor: cp } })) : null)
      var actions = _R.createElement('div', { style: { marginTop: '28px', display: 'flex', gap: '8px' } }, _R.createElement('button', { onClick: doRefresh, style: { flex: 1, padding: '9px 16px', border: 'none', borderRadius: '8px', background: cp, color: '#000', cursor: 'pointer', fontSize: '13px', fontWeight: 500, fontFamily: 'inherit' } }, t.refreshNow), _R.createElement('button', { onClick: function() { setCurrentImage(null); clearBg() }, style: { padding: '9px 16px', border: '1px solid ' + cb, borderRadius: '8px', background: 'transparent', color: cl, cursor: 'pointer', fontSize: '13px', fontWeight: 500, fontFamily: 'inherit' } }, t.clear))
      var imageInfo = currentImage ? _R.createElement('div', { style: { marginTop: '24px' } }, _R.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px' } }, _R.createElement('span', { style: st }, t.current), _R.createElement('span', { style: { fontSize: '11px', color: cs, maxWidth: '60%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, currentImage.source)), _R.createElement('div', { style: { borderRadius: '6px', overflow: 'hidden', border: '1px solid ' + cb, aspectRatio: '16 / 9', background: 'var(--dsw-alias-bg-layer-2, #f3f4f6)' } }, _R.createElement(LocalImagePreview, { image: currentImage }))) : null

      return _R.createElement('div', { style: { padding: '20px 24px' } },
        _R.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' } }, _R.createElement('h2', { style: { margin: 0, fontSize: '17px', fontWeight: 600, color: cl, letterSpacing: '-0.01em' } }, t.title), _R.createElement('button', { onClick: function() { setLang(lang === 'zh' ? 'en' : 'zh') }, style: { padding: '4px 10px', border: '1px solid ' + cb, borderRadius: '6px', background: 'transparent', color: cs, fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit' } }, t.lang)),
        _R.createElement('div', { style: { marginBottom: '24px' } }, _R.createElement('h3', { style: st }, t.source), sourceList, customInput, uploadArea),
        opacityRow, blurRow, refreshRow, actions, imageInfo
      )
    }

    // --------------------------------------------------------------------------
    // Auto-restore background on DSH startup
    // --------------------------------------------------------------------------
    var startup = loadSettings()
    if (startup && startup.currentImage && startup.currentImage.url) {
      var startupUrl = startup.currentImage.url
      // For local images, retrieve DataURL from IndexedDB
      if (startupUrl.startsWith('local-')) {
        idbGet(startupUrl).then(function(dataUrl) {
          if (dataUrl) applyBg(dataUrl, startup.opacity || 0.35, startup.blur || 0)
        })
      } else {
        applyBg(startupUrl, startup.opacity || 0.35, startup.blur || 0)
      }
    }

    // --------------------------------------------------------------------------
    // Register settings section
    // --------------------------------------------------------------------------
    slots.inject('settings.section', function() {
      slots.register(
        { name: 'settings.section', id: 'dsh-bg-image', label: 'Background', order: 50 },
        function(props) { return React.createElement(BeautifyPanel, props) }
      )
    })

    ctx.effect(function() { return function() { clearBg() } })
  }
}
