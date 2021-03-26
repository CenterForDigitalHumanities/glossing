const RERUM_URL = "http://tinydev.rerum.io/app/"
const DEFAULT_THUMB = "data:image/gif;base64,R0lGODlhAQABAIAAAMLCwgAAACH5BAAAAAAALAAAAAABAAEAAAICRAEAOw=="

class GlossManuscript {
  constructor() {
    this.is = performance.now().toString(32).replace(".","")
    this.id = undefined
    this.label = undefined
    this.thumb = DEFAULT_THUMB
    this.description = undefined
  }
  setProperty(prop,value){
    if(typeof prop !== "string") throw Error("Invalid Property. Expected `prop` to be a String.")
    if(this[prop] === value) return
    this[prop] = value
    const updateEvent = new CustomEvent("manuscript-update",{
      detail: {
        is: this.is,
        propertyName: prop

    })
  }
}

class GlossManuscriptThumb extends HTMLElement {
  constructor() {
    super()
    this.template = `
    <header class="label">${this.label ?? ""}</header>
    <img class="thumb" src="${this.thumb}">
    <span class="description">${this.description}</span>
    `
    this.ms = new GlossManuscript()
  }
}


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
  render(listOrItem) {
    const ul = this.querySelector(`ul`)
    if (!(ul ?? false)) {
      throw Error("List is missing!")
    }
    const renderItem = async (item) => {
      let li = document.querySelector(`[glossing-id="${item["@id"] ?? item.id}"]`)
      if (!(li ?? false)) {
        let newItem = document.createElement(`li`)
        newItem.setAttribute("glossing-id", item["@id"] ?? item.id)
        newItem.classList.add("loading")
        newItem.innerHTML = `
        <header class="label"></header>
        <img class="thumb">
        <span class="description"></span>
        `
        ul.appendChild(newItem)
        li = newItem
      }
      const label = item.name ?? item.label ?? item.title ?? false
      if (label) {
        li.querySelector('.label').innerHTML = label
        li.classList.remove("loading")
      }
      this._fetchLabel(item["@id"] ?? item.id).then(name => {
        item.name = name
        renderItem(item)
      })
    }
    if (!Array.isArray(listOrItem)) {
      ul.innerHTML = ``
      renderItem(listOrItem)
      return
    }
    listOrItem.forEach(renderItem)
  }

  async _fetchImage(target) {

  }

  async _fetchLabel(target) {
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

  _getLabel(obj, noLabel = "[ unlabeled ]", options = {}) {
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

  _getValue(property, asType, alsoPeek = []) {
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
}

customElements.define("gloss-manuscripts", GlossManuscripts)
