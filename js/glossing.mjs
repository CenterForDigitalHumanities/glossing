class GlossHeader extends HTMLElement {
    constructor() {
        super()
        const tmpl = `header`
        this.innerHTML = tmpl
    }
}

customElements.define('gloss-header',GlossHeader)

class GlossFooter extends HTMLElement {
    constructor() {
        super()
        const tmpl = `footer`
        this.innerHTML = tmpl
    }
}

customElements.define('gloss-footer',GlossFooter)
