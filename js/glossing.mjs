class GlossHeader extends HTMLElement {
    constructor() {
        super()
        const tmpl = `<header>
        <h1>Glossing Matthew</h1>
        <nav>
            <a href="about.html">About this project</a>
            <a href="browse.html">Browse Glosses</a>
            <a href="manuscripts.html">List of manuscripts</a>
            <a href="named-glosses.html">List of named Glosses</a>
        </nav>
        </header>`
        this.innerHTML = tmpl
    }
}

customElements.define('gloss-header',GlossHeader)

class GlossFooter extends HTMLElement {
    constructor() {
        super()
        const tmpl = `<footer>
                <a href="about.html">About this project</a>
                <a href="manuscripts.html">List of manuscripts</a>
                <a href="named-glosses.html">List of named Glosses</a>
        </footer>`
        this.innerHTML = tmpl
    }
}

customElements.define('gloss-footer',GlossFooter)
