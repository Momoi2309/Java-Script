console.clear();

class Picture {
    constructor(width, height, pixels) {
        this.width = width;
        this.height = height;
        this.pixels = pixels;
    }

    static empty(width, height, color) {
        let pixels = new Array(width * height).fill(color);
        return new Picture(width, height, pixels);
    }

    pixel(x, y) {
        return this.pixels[x + y * this.width];
    }

    draw(pixels) {
        let copy = this.pixels.slice();
        for (let { x, y, color } of pixels) {
            copy[x + y * this.width] = color;
        }

        return new Picture(this.width, this.height, copy);
    }
}

// STATE MANAGEMENT BEGIN
// function introduced early in the chapter but made irrelevant by later extension of Undo Control.
// function updateState(state, action) {
//   return Object.assign({}, state, action);
// }

function historyUpdateState(state, action) {
    if (action.undo == true) {
        if (state.done.length == 0) return state;
        return Object.assign({}, state, {
            picture: state.done[0],
            done: state.done.slice(1),
            doneAt: 0,
        });
    } else if (action.picture && state.doneAt < Date.now() - 1000) {
        return Object.assign({}, state, action, {
            done: [state.picture, ...state.done],
            doneAt: Date.now(),
        });
    } else {
        return Object.assign({}, state, action);
    }
}
// STATE MANAGEMENT END

// helper function to quickly create and insert dom nodes
function elt(type, props, ...children) {
    let dom = document.createElement(type);

    if (props) Object.assign(dom, props);

    for (let child of children) {
        if (typeof child != "string") dom.appendChild(child);
        else dom.appendChild(document.createTextNode(child));
    }

    return dom;
}

const scale = 10;

class PictureCanvas {
    constructor(picture, pointerDown) {
        this.dom = elt("canvas", {
            onmousedown: (event) => this.mouse(event, pointerDown),
            ontouchstart: (event) => this.touch(event, pointerDown),
        });
        this.syncState(picture);
    }
    // old syncstate func

    // syncState(picture) {
    //   if (this.picture == picture) return;
    //   this.picture = picture;
    //   drawPicture(this.picture, this.dom, scale);
    // }

    // EX 2
    syncState(picture) {
        if (this.picture == picture) return; // checks if the given picture obj is the same as the current picture obj of the instance
        drawPicture(picture, this.dom, scale, this.picture);
    }
    // END of EX2

    mouse(downEvent, onDown) {
        if (downEvent.button != 0) return;

        let pos = pointerPosition(downEvent, this.dom);
        let onMove = onDown(pos);

        if (!onMove) return;

        let move = (moveEvent) => {
            if (moveEvent.buttons == 0) {
                this.dom.removeEventListener("mousemove", move);
            } else {
                let newPos = pointerPosition(moveEvent, this.dom);
                if (newPos.x == pos.x && newPos.y == pos.y) return;

                pos = newPos;
                onMove(newPos);
            }
        };

        this.dom.addEventListener("mousemove", move);
    }

    touch(startEvent, onDown) {
        let pos = pointerPosition(startEvent.touches[0], this.dom);
        let onMove = onDown(pos);
        startEvent.preventDefault();
        if (!onMove) return;

        let move = (moveEvent) => {
            let newPos = pointerPosition(moveEvent.touches[0], this.dom);
            if (newPos.x == pos.x && newPos.y == pos.y) return;
            pos = newPos;
            onMove(newPos);
        };

        let end = () => {
            this.dom.removeEventListener("touchmove", move);
            this.dom.removeEventListener("touchend", end);
        };

        this.dom.addEventListener("touchmove", move);
        this.dom.addEventListener("touchend", end);
    }
}
// EX 2 EFFICIENT DRAWING
function drawPicture(newPic, canvas, scale, oldPic) { // newpic obj, canvas, scale number, optional oldpic obj
    // newpic obj with width and height prop. and a pixel method that takes in x and y coordinates to return a color string
    // canvas - getcontext method that return a context obj that provides methods for drawing on the canvas
    if (
        !oldPic ||
        (oldPic.width !== newPic.width && oldPic.height !== newPic.height)
    ) {
        canvas.width = newPic.width * scale;
        canvas.height = newPic.height * scale;
    }
    //Next, the function gets the 2D context of the canvas element using the getContext method
    // and loops through the newPic object's pixels using two nested for loops.
    // For each pixel, the function checks if there is no oldPic or if the pixel at the same x and y coordinates in the oldPic
    // object is different from the pixel in the newPic object.
    // If either of these conditions is true, the function sets the fill style of the context to the color of the pixel using
    // newPic.pixel(x, y), and fills a rectangle with the size of scale at the pixel's x and y coordinates on the canvas
    // using cx.fillRect(x * scale, y * scale, scale, scale).
    let cx = canvas.getContext("2d");

    for (let y = 0; y < newPic.height; y++) {
        for (let x = 0; x < newPic.width; x++) {
            if (!oldPic || oldPic.pixel(x, y) !== newPic.pixel(x, y)) {
                cx.fillStyle = newPic.pixel(x, y);
                cx.fillRect(x * scale, y * scale, scale, scale);
            }
        }
    }
}
//this function draws a new picture on a canvas element by looping through the pixels of the picture and
// filling rectangles on the canvas for each pixel that has changed from the previous picture.
// It scales the size of the canvas element according to the scale parameter and updates the canvas element with the new picture.
// END OF EX2

function pointerPosition(pos, domNode) {
    let rect = domNode.getBoundingClientRect();
    return {
        x: Math.floor((pos.clientX - rect.left) / scale),
        y: Math.floor((pos.clientY - rect.top) / scale),
    };
}

// UI ELEMENTS BEGIN // EX1
class PixelEditor {
    constructor(state, config) {
        let { tools, controls, dispatch } = config; // config obj with tools, controls, dispatch properties
        this.state = state;

        this.canvas = new PictureCanvas(state.picture, (pos) => { //The constructor function creates a new PictureCanvas object with the state.picture
            // and a callback function that gets called whenever the user interacts with the canvas.
            // The callback function gets the current tool, calls it with the pos, state, and dispatch arguments, and returns a function that
            // can be called with the updated pos.
            let tool = tools[this.state.tool];
            let onMove = tool(pos, this.state, dispatch);
            if (onMove) return (pos) => onMove(pos, this.state);
        });
        //The controls property is an array of control classes, and the constructor creates a new instance of each control class,
        // passing in the state and config arguments.
        this.controls = controls.map((Control) => new Control(state, config));
        this.dom = elt(
            "div",
            { tabIndex: 0 },
            this.canvas.dom,
            elt("br"),
            ...this.controls.reduce((a, c) => a.concat(" ", c.dom), [])
        );
        // KEYBOARD BINDINGS
        this.dom.addEventListener("keydown", (e) => {
            // listen for Ctrl / Cmd key + assigned control shortcut letter
            //The keydown event listener checks if the Ctrl or Cmd key is being held down by checking the ctrlKey property of the event object e.
            // If the Ctrl or Cmd key is being held down, the event listener loops through each control and checks if the control has a shortcut
            // property that matches the key that was pressed. If a control has a matching shortcut property, the event listener calls the click()
            // method of the control's dom element and prevents the default behavior of the event using preventDefault().
            if (e.ctrlKey) {
                this.controls.forEach((ctrl, i) => {
                    if (ctrl.shortcut && e.code === `Key${ctrl.shortcut}`) {
                        e.preventDefault();
                        ctrl.dom.click();
                    }
                });
            } else { //If the Ctrl or Cmd key is not being held down, the event listener listens for the first letter of each tool name.
                // It creates an array of the first letters of each tool name using Object.keys(tools).map((tool) => tool.slice(0, 1))
                // and then loops through this array to check if the key that was pressed matches one of the first letters of the tool names.
                // If a match is found, the event listener calls the dispatch function with an object containing the tool property set to the tool
                // name associated with the matching first letter.
                // listen for first letter of tool names

                let toolShortcuts = Object.keys(tools).map((tool) => tool.slice(0, 1));
                toolShortcuts.forEach((letter) => {
                    if (e.key === letter) {
                        dispatch({
                            tool: Object.keys(tools)[toolShortcuts.indexOf(letter)],
                        });
                    }
                });
            }
        });
    }
    /// END OF EX1
    syncState(state) {
        this.state = state;
        this.canvas.syncState(state.picture);
        for (let ctrl of this.controls) ctrl.syncState(state);
    }
}

class ToolSelect {
    constructor(state, { tools, dispatch }) {
        this.select = elt(
            "select",
            {
                onchange: () => dispatch({ tool: this.select.value }),
            },
            ...Object.keys(tools).map((name) =>
                elt(
                    "option",
                    {
                        selected: name == state.tool,
                    },
                    name
                )
            )
        );
        this.dom = elt("label", null, "🖌 Tool: ", this.select);
    }

    syncState(state) {
        this.select.value = state.tool;
    }
}

class ColorSelect {
    constructor(state, { dispatch }) {
        this.input = elt("input", {
            type: "color",
            value: state.color,
            onchange: () => dispatch({ color: this.input.value }),
        });
        this.dom = elt("label", null, "🎨 Color: ", this.input);
        this.shortcut = "C";
    }

    syncState(state) {
        this.input.value = state.color;
    }
}

class SaveButton {
    constructor(state) {
        this.picture = state.picture;
        this.dom = elt(
            "button",
            {
                onclick: () => this.save(),
            },
            "💾 Save"
        );
        this.shortcut = "S";
    }

    save() {
        let canvas = elt("canvas");
        drawPicture(this.picture, canvas, 5);
        let link = elt("a", {
            href: canvas.toDataURL(),
            download: "pixelart.png",
        });

        document.body.appendChild(link);
        link.click();
        link.remove();
    }

    syncState(state) {
        this.picture = state.picture;
    }
}

class LoadButton {
    constructor(_, { dispatch }) {
        this.dom = elt(
            "button",
            {
                onclick: () => startLoad(dispatch),
            },
            "📁 Load"
        );
        this.shortcut = "L";
    }

    syncState() {}
}

function startLoad(dispatch) {
    let input = elt("input", {
        type: "file",
        onchange: () => finishLoad(input.files[0], dispatch),
    });

    document.body.appendChild(input);
    input.click();
    input.remove();
}

function finishLoad(file, dispatch) {
    if (file == null) return;
    let reader = new FileReader();
    reader.addEventListener("load", () => {
        let image = elt("img", {
            onload: () =>
                dispatch({
                    picture: pictureFromImage(image),
                }),
            src: reader.result,
        });
    });
    reader.readAsDataURL(file);
}

function pictureFromImage(image) {
    let width = Math.min(100, image.width);
    let height = Math.min(100, image.height);
    let canvas = elt("canvas", { width, height });
    let cx = canvas.getContext("2d");
    cx.drawImage(image, 0, 0);

    let pixels = [];
    let { data } = cx.getImageData(0, 0, width, height);

    function hex(n) {
        //helper function to make rgb color strings from canvas ImageData
        return n.toString(16).padStart(2, "0");
    }

    for (let i = 0; i < data.length; i += 4) {
        let [r, g, b] = data.slice(i, i + 3);
        pixels.push(`#${hex(r)}${hex(g)}${hex(b)}`);
    }
    return new Picture(width, height, pixels);
}

class UndoButton {
    constructor(state, { dispatch }) {
        this.dom = elt(
            "button",
            {
                onclick: () => dispatch({ undo: true }),
                disabled: state.done.length == 0,
            },
            "⮪ Undo"
        );
        this.shortcut = "Z";
    }

    syncState(state) {
        this.dom.disabled = state.done.length == 0;
    }
}
// UI ELEMENTS END

// DRAWING FUNCTIONALITY BEGIN
function dist(x1, y1, x2, y2) {
    return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

function drawLine(from, to, color) {
    let points = [];
    if (Math.abs(from.x - to.x) > Math.abs(from.y - to.y)) {
        if (from.x > to.x) [from, to] = [to, from];
        let slope = (to.y - from.y) / (to.x - from.x);
        for (let { x, y } = from; x <= to.x; x++) {
            points.push({ x, y: Math.round(y), color });
            y += slope;
        }
    } else {
        if (from.y > to.y) [from, to] = [to, from];
        let slope = (to.x - from.x) / (to.y - from.y);
        for (let { x, y } = from; y <= to.y; y++) {
            points.push({ x: Math.round(x), y, color });
            x += slope;
        }
    }
    return points;
}

// EX 4 PROPER LINES
//The draw function takes the pos, state, and dispatch as arguments.
// It returns another function called connect. When connect is called with a new position newPos,
// it draws a line from the last position to the new position with the current color in the state, and updates
// the picture in the state using the draw method of the picture object. The pos value is then updated to be the new position
// , so that the next call to connect will continue from where the last line ended.
//
// The line function takes the start, state, and dispatch as arguments and returns another function
// that can be used to draw a line from the start position to the end position.
// The drawLine function is called with the start and end positions, and the current color from the state.
// The resulting line is then drawn on the picture in the state using the draw method of the picture object.
// The updated picture is then dispatched to the reducer function to update the state.
function draw(pos, state, dispatch) {
    function connect(newPos, state) {
        let line = drawLine(pos, newPos, state.color);
        pos = newPos;
        dispatch({ picture: state.picture.draw(line) });
    }
    connect(pos, state);
    return connect;
}

function line(start, state, dispatch) {
    return (end) => {
        let line = drawLine(start, end, state.color);
        dispatch({ picture: state.picture.draw(line) });
    };
}
// END OF EX4

function rectangle(start, state, dispatch) {
    function drawRectangle(pos) {
        let xStart = Math.min(start.x, pos.x);
        let yStart = Math.min(start.y, pos.y);
        let xEnd = Math.max(start.x, pos.x);
        let yEnd = Math.max(start.y, pos.y);
        let drawn = [];
        for (let y = yStart; y <= yEnd; y++) {
            for (let x = xStart; x <= xEnd; x++) {
                drawn.push({ x, y, color: state.color });
            }
        }
        dispatch({ picture: state.picture.draw(drawn) });
    }
    drawRectangle(start);
    return drawRectangle;
}

// EX 3 CIRCLES
function circle(start, state, dispatch) {
    //The drawCircle function calculates the radius of a circle based on the distance between the start point and the current position pos.
    function drawCircle(pos) {
        let drawn = [];
        let r = Math.floor(dist(start.x, start.y, pos.x, pos.y));
    //It then loops through all the pixels within a square bounding box around the circle, and adds each pixel that
        // falls within the circle to an array called drawn.
        // Each pixel is represented as an object with x and y coordinates and a color property taken from the state parameter.
        for (let y = start.y - r; y <= start.y + r; y++) {
            for (let x = start.x - r; x <= start.x + r; x++) {
                if (Math.floor(dist(start.x, start.y, x, y)) <= r) {
                    drawn.push({ x, y, color: state.color });
                }
            }
        }
        //After all the pixels have been added to drawn, the drawCircle function calls the dispatch function,
        // passing in an object with a picture property. The picture property is created by calling the draw method on the state.picture
        // object and passing in the drawn array.
        dispatch({ picture: state.picture.draw(drawn) });
    }
    drawCircle(start); // called repeatedly as the user moves the mouse to draw the circle at different positions.
    return drawCircle;
}
// END OF EX3

const around = [
    { dx: -1, dy: 0 },
    { dx: 1, dy: 0 },
    { dx: 0, dy: -1 },
    { dx: 0, dy: 1 },
];

function fill({ x, y }, state, dispatch) {
    let targetColor = state.picture.pixel(x, y);
    let drawn = [{ x, y, color: state.color }];
    for (let done = 0; done < drawn.length; done++) {
        for (let { dx, dy } of around) {
            let x = drawn[done].x + dx,
                y = drawn[done].y + dy;

            if (
                x >= 0 &&
                x < state.picture.width &&
                y >= 0 &&
                y < state.picture.height &&
                state.picture.pixel(x, y) == targetColor &&
                !drawn.some((p) => p.x == x && p.y == y)
            ) {
                drawn.push({ x, y, color: state.color });
            }
        }
    }

    dispatch({ picture: state.picture.draw(drawn) });
}

function pick(pos, state, dispatch) {
    dispatch({ color: state.picture.pixel(pos.x, pos.y) });
}
// DRAWING FUNCTIONALITY END

// Initiate App
let startState = {
    tool: "draw",
    color: "#000000",
    picture: Picture.empty(60, 30, "#f0f0f0"),
    done: [],
    doneAt: 0,
};
const baseTools = { draw, line, fill, circle, rectangle, pick };
const baseControls = [
    ToolSelect,
    ColorSelect,
    SaveButton,
    LoadButton,
    UndoButton,
];

function startPixelEditor({
                              state = startState,
                              tools = baseTools,
                              controls = baseControls,
                          }) {
    let app = new PixelEditor(state, {
        tools,
        controls,
        dispatch(action) {
            state = historyUpdateState(state, action);
            app.syncState(state);
        },
    });
    return app.dom;
}

document.getElementById("editor").appendChild(startPixelEditor({}));
