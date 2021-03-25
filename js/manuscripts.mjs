class GlossManuscripts extends HTMLElement {
    constructor() {
        super()
        const tmpl = `Loading manuscripts for Glossing Matthew&hellip;`
        this.innerHTML = tmpl
    }
}

customElements.define('gloss-manuscripts',GlossManuscripts)
