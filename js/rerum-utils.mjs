const RERUM_URL = "http://tinydev.rerum.io/app/"
const DEFAULT_THUMB = "data:image/gif;base64,R0lGODlhAQABAIAAAMLCwgAAACH5BAAAAAAALAAAAAABAAEAAAICRAEAOw=="

export async function _fetchImage(uri) {
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

export async function _fetchLabel(target) {
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

export function _getLabel(obj, noLabel = "[ unlabeled ]", options = {}) {
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

export function _getValue(property, asType, alsoPeek = []) {
  // TODO: There must be a best way to do this...
  const PEEK = ["@value", "value", "$value", "val"]
  let prop;
  if (property === undefined || property === "") {
    console.error("Value of property to lookup is missing!")
    return undefined
  }
  if (Array.isArray(property)) {
    // It is an array of things, we can only presume that we want the array.
    // If it needs to become a string, local functions take on that responsibility.
    return property
  }
  prop = property
  if (typeof property === "object") {
    alsoPeek = PEEK.concat(alsoPeek)
    for (const k of alsoPeek) {
      if (property.hasOwnProperty(k)) {
        prop = property[k]
        break
      }
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
    }
  }
  return (prop.length === 1) ? prop[0] : prop
}
