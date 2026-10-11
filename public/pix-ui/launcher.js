const SERVICES = [
  {name:'Pix Message', meta:'Мессенджер в тестировании', icon:'MSG', state:'Тест', status:'pilot', domain:'pix-message.duckdns.org', url:'https://pix-message.duckdns.org/'},
  {name:'Pix Study', meta:'Обучение и задачи', icon:'STY', state:'Открыть', status:'ready', domain:'pix-study.duckdns.org', url:'https://pix-study.duckdns.org/'},
  {name:'Pix VPN', meta:'Клиент Secyx для Android', icon:'VPN', state:'Скачать', url:'https://pix-message.duckdns.org/downloads/SecyxVPN-arm64.apk'},
  {name:'Pix Drive', meta:'Демонстрационный интерфейс без серверного хранилища', icon:'DRV', state:'Превью', status:'pilot', domain:'drive.pix-hub.duckdns.org', url:'https://drive.pix-hub.duckdns.org/'},
  {name:'Pix Photos', meta:'Личная фототека', icon:'PIC', state:'В плане', domain:'pix-photo.duckdns.org'},
  {name:'Pix Notes', meta:'Заметки и черновики', icon:'NTS', state:'В плане', domain:'pix-note.duckdns.org'},
  {name:'Pix Search', meta:'Метапоиск; запросы уходят внешним источникам', icon:'SRC', state:'Пилот', domain:'pix-search.duckdns.org'},
  {name:'Pix Tube', meta:'Видео и подписки', icon:'VID', state:'В плане', domain:'pix-tube.duckdns.org'},
  {name:'Pix Mail', meta:'Почта на своём домене', icon:'MAIL', state:'В плане', domain:'pix-mail.duckdns.org'},
  {name:'Pix Vault', meta:'Менеджер паролей', icon:'KEY', state:'В плане'},
  {name:'Pix Account', meta:'Единый вход Pix', icon:'ACC', state:'Пилот', domain:'pix-account.duckdns.org'},
  {name:'Pix Hub', meta:'Каталог сервисов Pix', icon:'HUB', state:'Пилот', status:'pilot', domain:'pix-hub.duckdns.org', url:'/pix/'},
]

class PixLauncher extends HTMLElement {
  connectedCallback() {
    if (this.shadowRoot) return
    const root = this.attachShadow({mode:'open'})
    const label = (this.getAttribute('label') || 'Приложения').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]))
    root.innerHTML = `<link rel="stylesheet" href="/pix-ui/tokens.css"><div class="pix-launcher"><button class="pix-launcher__trigger" type="button" aria-expanded="false" aria-haspopup="true" aria-controls="pix-launcher-menu"><span class="pix-launcher__mark" aria-hidden="true">P</span><span>${label}</span><span aria-hidden="true">▾</span></button><div id="pix-launcher-menu" class="pix-launcher__menu" hidden><p class="pix-launcher__heading">Экосистема Pix</p>${SERVICES.map(item => item.url ? `<a class="pix-launcher__item" href="${item.url}" ${item.url.endsWith('.apk') ? 'download' : ''}><span class="pix-launcher__icon" aria-hidden="true">${item.icon}</span><span><span class="pix-launcher__name">${item.name}</span><span class="pix-launcher__meta">${item.meta}</span>${item.domain ? `<span class="pix-launcher__meta">${item.domain}${item.status === 'pilot' ? ' · пилот' : ''}</span>` : ''}</span><span class="pix-launcher__state" data-state="${item.status || 'planned'}">${item.state}</span></a>` : `<span class="pix-launcher__item" aria-disabled="true"><span class="pix-launcher__icon" aria-hidden="true">${item.icon}</span><span><span class="pix-launcher__name">${item.name}</span><span class="pix-launcher__meta">${item.meta}</span>${item.domain ? `<span class="pix-launcher__meta">${item.domain}${item.domain.includes('DNS ещё не настроен') ? '' : ' · DNS есть, TLS нужен'}</span>` : ''}</span><span class="pix-launcher__state" data-state="planned">${item.state}</span></span>`).join('')}</div></div>`
    const button = root.querySelector('button')
    const menu = root.querySelector('.pix-launcher__menu')
    const close = () => { menu.hidden = true; button.setAttribute('aria-expanded','false') }
    button.addEventListener('click', () => { menu.hidden = !menu.hidden; button.setAttribute('aria-expanded', String(!menu.hidden)) })
    root.addEventListener('keydown', event => { if (event.key === 'Escape') { close(); button.focus() } })
    document.addEventListener('click', event => { if (!event.composedPath().includes(this)) close() })
  }
}

if (!customElements.get('pix-launcher')) customElements.define('pix-launcher', PixLauncher)

