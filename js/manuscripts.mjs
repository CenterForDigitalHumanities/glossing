const RERUM_URL = "http://tinydev.rerum.io/app/"
const DEFAULT_THUMB = "data:image/gif;base64,R0lGODlhAQABAIAAAMLCwgAAACH5BAAAAAAALAAAAAABAAEAAAICRAEAOw=="

class GlossManuscript {
  constructor() {
    this.is = performance.now().toString(32).replace(".", "")
    this.id = undefined
    this.label = undefined
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
    this.ms = new GlossManuscript()
    this.ms.id = this.getAttribute("glossing-id")
    this.setAttribute("glossing-is",this.ms.is)
    this.template = `<li glossing-is="${this.ms.is}" glossing-id="${this.ms.id}" class="loading">
    <header class="label">${this.ms.label ?? ""}</header>
    <img class="thumb" src="${this.ms.thumb}">
    <span class="description">${this.ms.description}</span>
    </li>
    `
  }

  connectedCallback(){
    this.render()
  }

  render() {
    let item = document.querySelector(`[glossing-is="${this.ms.is}"]`)
    if (!(item ?? false)) {throw Error("Attempted to render missing element.")}
    const label = this.ms.name ?? this.ms.label ?? this.ms.title ?? false
    if (label) {
      item.querySelector('.label').innerHTML = label
      item.classList.remove("loading")
    }
    _fetchLabel(this.ms["@id"] ?? this.ms.id).then(name => {
      this.ms.name = name
      this.render()
    })
  }
}

customElements.define("gloss-manuscript-thumb", GlossManuscriptThumb)

class GlossManuscripts extends HTMLElement {
  constructor() {
    super()
    const tmpl = `<ul class="tiled">
    </ul>`
    this.innerHTML = tmpl
    this.collection = this.getAttribute("gloss-collection")
  }
  connectedCallback() {
    const filterObj = {
      "__rerum.history.next": { $exists: true, $size: 0 },
    }
    const queryObj = {
      $or: [
        {
          targetCollection: this.collection,
        },
        {
          "body.targetCollection": this.collection,
        },
        {
          "body.partOf": this.collection
        }
      ]
    }
    Object.assign(queryObj, filterObj)
    fetch(RERUM_URL + "query", {
      method: "POST",
      mode: "cors",
      body: JSON.stringify(queryObj),
    })
      .then((response) => response.json())
      .then((pointers) => {
        let list = []
        pointers.map((tc) =>
          list.push(
            fetch(tc.target || tc["@id"] || tc.id).then((response) =>
              response.json().catch((err) => {
                throw err
              })
            )
          )
        )
        return Promise.all(list).then((l) =>
          l.filter((i) => !i.hasOwnProperty("__deleted"))
        )
      })
      .then(this.render.bind(this))
  }
  render(items) {
    const ul = this.querySelector(`ul`)
    if (!(ul ?? false)) { throw Error("List is missing!") }
    if (!Array.isArray(items)) { items = [items] }
    ul.innerHTML = items.reduce((a, b) => a += `<gloss-manuscript-thumb glossing-id="${b['@id'] ?? b.id}"></gloss-manuscript-thumb>`, ``)
  }
}

customElements.define("gloss-manuscripts", GlossManuscripts)

async function _fetchImage(target) {

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
    const response = await fetch(RERUM_URL + "query", {
      method: "POST",
      mode: "cors",
      body: JSON.stringify(queryObj),
    })
    const annos = await response.json()
    for (const a of annos) {
      const label = this._getLabel(a.body, "")
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
    label = [...new Set(label.map(l => this._getValue(l)))]
  }
  if (typeof label === "object") {
    label = this._getValue(label)
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
