class GlossHeader extends HTMLElement {
    constructor() {
        super()
        const tmpl = `<header>
        <h1>Glossing Matthew</h1>
        </header>`
        this.innerHTML = tmpl
    }
}

customElements.define('gloss-header',GlossHeader)

class GlossFooter extends HTMLElement {
    constructor() {
        super()
        const tmpl = `<footer>
            <nav>
                <a href="about.html">About this project</a>
                <a href="manuscripts.html">List of manuscripts</a>
                <a href="named-glosses.html">List of named Glosses</a>
            </nav>
        </footer>`
        this.innerHTML = tmpl
    }
}

customElements.define('gloss-footer',GlossFooter)
