import * as Utils from './rerum-utils.mjs'

const RERUM_URL = "http://tinydev.rerum.io/app/"
const DEFAULT_THUMB = "data:image/gif;base64,R0lGODlhAQABAIAAAMLCwgAAACH5BAAAAAAALAAAAAABAAEAAAICRAEAOw=="

class GlossManuscript {
  constructor(id,label) {
    this.is = performance.now().toString(32).replace(".", "")
    this.id = id
    this.label = label
    this.thumb = DEFAULT_THUMB
    this.description = undefined
  }
  setProperty(prop, value) {
    if (typeof prop !== "string") throw Error("Invalid Property. Expected `prop` to be a String.")
    if (this[prop] === value) return
    const updateEvent = new CustomEvent("manuscript-update", {
      detail: {
        is: this.is,
        propertyName: prop,
        oldVal: this[prop],
        newVal: value
      }
    })
    document.dispatchEvent(updateEvent)
    this[prop] = value
  }


}

class GlossManuscriptThumb extends HTMLElement {
  constructor() {
    super()
    this.ms = new GlossManuscript(this.getAttribute("glossing-id"),this.getAttribute("title"))
    this.setAttribute("glossing-is", this.ms.is)
    this.template = `<li glossing-is="${this.ms.is}" glossing-id="${this.ms.id}">
    <header class="label">${this.ms.label ?? ""}</header>
    <img class="thumb" src="${this.ms.thumb || DEFAULT_THUMB}">
    <span class="description">${this.ms.description ?? ""}</span>
    </li>
    `
    this.classList.add("loading")
    this.innerHTML = this.template
  }

  connectedCallback() {
    this.render()
  }

  render(lastCall) {
    let item = document.querySelector(`[glossing-is="${this.ms.is}"]`)
    if (!(item ?? false)) { throw Error("Attempted to render missing element.") }
    const label = this.ms.name ?? this.ms.label ?? this.ms.title ?? false
    if (!label) {
      return _fetchLabel(this.ms["@id"] ?? this.ms.id).then(name => {
        this.ms.name = name
        if (lastCall) return
        this.render(true)
      })
    }
    item.querySelector('.label').innerHTML = label
    item.classList.remove("loading")
    if (this.ms.thumb !== DEFAULT_THUMB) {
      item.querySelector('.thumb').src = this.ms.thumb
      item.classList.remove("loading")
    } else {
      _fetchImage(this.ms["@id"] ?? this.ms.id).then(src => {
        this.ms.thumb = src || DEFAULT_THUMB
        if (lastCall) return
        this.render(true)
      })
    }
  }
}

customElements.define("gloss-manuscript-thumb", GlossManuscriptThumb)

class GlossManuscripts extends HTMLElement {
  constructor() {
    super()
    const tmpl = `<ul class="tiled">
    </ul>`
    this.innerHTML = tmpl
    this.uri = this.getAttribute("glossing-id")
  }
  connectedCallback() {
    fetch(this.uri)
      .then((response) => response.json())
      .then((pointers) => {
        return pointers.itemListElement
      })
      .then(this.render.bind(this))
  }
  render(items) {
    const ul = this.querySelector(`ul`)
    if (!(ul ?? false)) { throw Error("List is missing!") }
    if (!Array.isArray(items)) { items = [items] }
    ul.innerHTML = items.reduce((a, b) => a += `<gloss-manuscript-thumb glossing-id="${b['@id'] ?? b.id}" title="${b.label}"></gloss-manuscript-thumb>`, ``)
  }
}

customElements.define("gloss-manuscripts", GlossManuscripts)

async function _fetchImage(uri) {
  const TPEN_PROJECT_NUMBER = "tpen://base-project"
  try {
    const filterObj = {
      "__rerum.history.next": { $exists: true, $size: 0 },
    }
    const queryObj = {
      target: uri
    }
    // Object.defineProperty(queryObj, "body['" + TPEN_PROJECT_NUMBER + "']", { $exists: true })
    Object.assign(queryObj, filterObj)
    const pointers = await fetch(RERUM_URL + "query", {
      method: "POST",
      mode: "cors",
      body: JSON.stringify(queryObj),
    })
      .then((response) => response.json())
    if (!pointers[0]) { return false }
    let imguri = false
    for (const anno of pointers) {
      if (anno.body[TPEN_PROJECT_NUMBER]) {
        imguri = _getValue(anno.body[TPEN_PROJECT_NUMBER])
        break
      }
    }
    if (!imguri) { return false }
    const manifest = await fetch("http://t-pen.org/TPEN/manifest/" + imguri)
      .then(res => res.json())
    if (manifest.thumbnail) {
      return manifest.thumbnail[0].id ?? manifest.thumbnail[0]['@id'] ?? manifest.thumbnail.id ?? manifest.thumbnail['@id'] ?? manifest.thumbnail
    }
    const canvases = manifest.items ?? manifest.sequences[0]?.canvases
    const middleCanvas = canvases[Math.floor(canvases.length / 2)]
    return (middleCanvas.items && middleCanvas.items[0].id) ?? (middleCanvas.images && (middleCanvas.images[0]?.resource['@id'] ?? middleCanvas.images[0]?.resource.id)) ?? false
  } catch (err) {
    console.error("Image not found")
  }
}

async function _fetchLabel(target) {
  const filterObj = { "__rerum.history.next": { $exists: true, $size: 0 } }
  const queryObj = {
    $and: [
      {
        $or: [
          { target: target, },
          { hasTarget: target, },
          { 'target.value': target, }
        ]
      },
      {
        $or: [
          { 'body.label': { $exists: true } },
          { 'body.name': { $exists: true } },
          { 'body.title': { $exists: true } }
        ]
      }
    ]
  }
  Object.assign(queryObj, filterObj)
  try {
    const annos = await fetch(RERUM_URL + "query", {
      method: "POST",
      mode: "cors",
      body: JSON.stringify(queryObj),
    }).then(response => response.json())
    for (const a of annos) {
      const label = _getLabel(a.body, "")
      if (label?.length) {
        return label
      }
    }
    return "[ unlabeled ]"
  } catch (err) {
    return "[ label error ]"
  }
}

function _getLabel(obj, noLabel = "[ unlabeled ]", options = {}) {
  if (typeof obj === "string") { return obj }
  let label = obj[options.label] || obj.name || obj.label || obj.title
  if (Array.isArray(label)) {
    label = [...new Set(label.map(l => _getValue(l)))]
  }
  if (typeof label === "object") {
    label = _getValue(label)
  }
  return label || noLabel
}

function _getValue(property, asType, alsoPeek = []) {
  // TODO: There must be a best way to do this...
  let prop;
  if (property === undefined || property === "") {
    console.error("Value of property to lookup is missing!")
    return undefined
  }
  if (Array.isArray(property)) {
    // It is an array of things, we can only presume that we want the array.  If it needs to become a string, local functions take on that responsibility.
    return property
  } else {
    if (typeof property === "object") {
      // TODO: JSON-LD insists on "@value", but this is simplified in a lot
      // of contexts. Reading that is ideal in the future.
      if (!Array.isArray(alsoPeek)) {
        alsoPeek = [alsoPeek]
      }
      alsoPeek = alsoPeek.concat(["@value", "value", "$value", "val"])
      for (let k of alsoPeek) {
        if (property.hasOwnProperty(k)) {
          prop = property[k]
          break
        } else {
          prop = property
        }
      }
    } else {
      prop = property
    }
  }
  try {
    switch (asType.toUpperCase()) {
      case "STRING":
        prop = prop.toString();
        break
      case "NUMBER":
        prop = parseFloat(prop);
        break
      case "INTEGER":
        prop = parseInt(prop);
        break
      case "BOOLEAN":
        prop = !Boolean(["false", "no", "0", "", "undefined", "null"].indexOf(String(prop).toLowerCase().trim()));
        break
      default:
    }
  } catch (err) {
    if (asType) {
      throw new Error("asType: '" + asType + "' is not possible.\n" + err.message)
    } else {
      // no casting requested
    }
  }
  return (prop.length === 1) ? prop[0] : prop
}
