import { glMatrix, mat4, vec3 } from "gl-matrix";
import { BaseDraw } from "./BaseDraw";
import { PieceState } from "../PieceState";
import { Piece } from "../GameDef";
import { ArrayMatrix } from "../../utils/ArrayMatrix";
import { Keys } from "../InputManager";

const isPowerOf2 = (value: number) => {
	return (value & (value - 1)) === 0;
};

enum Layers {
	UI,
	BOARD,
	GRID,
	LENGTH,
}

enum RenderTypes {
	PBR_XY,
	PBR_UV,
	PBR_MASK,
	LINE_XY,
	LINE_COLOR,
	TRI_XY,
	TRI_COLOR,
	SIMPLE_XY,
	SIMPLE_COLOR,
	LENGTH,
}

interface LayerData {
	data: number[][];
	translate: vec3;
	rotate: number;
	rotationOrigin: vec3;
}

class LayerManager {
	layers: Map<Layers, LayerData> = new Map();
	currentLayer: Layers = Layers.UI;
	buffers: Map<RenderTypes, WebGLBuffer> = new Map();
	vertexes: Map<Layers, number[]> = new Map();

	use(layer: Layers) {
		this.currentLayer = layer;
	}

	clear(layer: Layers) {
		this.layers.set(layer, {
			data: new Array(RenderTypes.LENGTH).fill(0).map(() => []),
			translate: [0, 0, 0],
			rotate: 0,
			rotationOrigin: [0, 0, 0],
		});
		this.vertexes.set(layer, new Array(RenderTypes.LENGTH).fill(0));
	}

	translate(vec: vec3) {
		const out = this.layers.get(this.currentLayer)!.translate;
		vec3.add(out, out, vec);
	}

	rotate(angle: number) {
		this.layers.get(this.currentLayer)!.rotate += angle;
	}

	setRotationOrigin(origin: vec3) {
		this.layers.get(this.currentLayer)!.rotationOrigin = origin;
	}

	addPBRTriVertexes(count: number) {
		const layer = this.vertexes.get(this.currentLayer)!;
		layer[RenderTypes.PBR_XY] += count;
	}

	pushPBRTriXY(...data: number[]) {
		const layer = this.layers.get(this.currentLayer)!;
		layer.data[RenderTypes.PBR_XY].push(...data);
	}

	pushPBRTriUV(...data: number[]) {
		const layer = this.layers.get(this.currentLayer)!;
		layer.data[RenderTypes.PBR_UV].push(...data);
	}

	pushPBRTriMask(...data: number[]) {
		const layer = this.layers.get(this.currentLayer)!;
		layer.data[RenderTypes.PBR_MASK].push(...data);
	}

	addLineVertexes(count: number) {
		const layer = this.vertexes.get(this.currentLayer)!;
		layer[RenderTypes.LINE_XY] += count;
	}

	pushLineXY(...data: number[]) {
		const layer = this.layers.get(this.currentLayer)!;
		layer.data[RenderTypes.LINE_XY].push(...data);
	}

	pushLineColor(...data: number[]) {
		const layer = this.layers.get(this.currentLayer)!;
		layer.data[RenderTypes.LINE_COLOR].push(...data);
	}

	addTriVertexes(count: number) {
		const layer = this.vertexes.get(this.currentLayer)!;
		layer[RenderTypes.TRI_XY] += count;
	}

	pushTriXY(...data: number[]) {
		const layer = this.layers.get(this.currentLayer)!;
		layer.data[RenderTypes.TRI_XY].push(...data);
	}

	pushTriColor(...data: number[]) {
		const layer = this.layers.get(this.currentLayer)!;
		layer.data[RenderTypes.TRI_COLOR].push(...data);
	}

	fillBuffer(gl: WebGL2RenderingContext, renderType: RenderTypes) {
		const data: number[] = [];
		for (let layerType = 0; layerType < Layers.LENGTH; layerType++) {
			const layer = this.layers.get(layerType)!;
			data.push(...layer.data[renderType]);
		}

		const buffer = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.DYNAMIC_DRAW);

		this.buffers.set(renderType, buffer);
	}

	fillBufferCombined(gl: WebGL2RenderingContext, parent: RenderTypes, ...renderTypes: RenderTypes[]) {
		const data: number[] = [];
		for (const renderType of renderTypes) {
			for (let layerType = 0; layerType < Layers.LENGTH; layerType++) {
				const layer = this.layers.get(layerType)!;
				data.push(...layer.data[renderType]);
			}
		}

		const buffer = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.DYNAMIC_DRAW);

		this.buffers.set(parent, buffer);
	}

	commit(gl: WebGL2RenderingContext) {
		this.fillBuffer(gl, RenderTypes.PBR_XY);
		this.fillBuffer(gl, RenderTypes.PBR_UV);
		this.fillBuffer(gl, RenderTypes.PBR_MASK);

		this.fillBufferCombined(gl, RenderTypes.SIMPLE_XY, RenderTypes.LINE_XY, RenderTypes.TRI_XY);
		this.fillBufferCombined(gl, RenderTypes.SIMPLE_COLOR, RenderTypes.LINE_COLOR, RenderTypes.TRI_COLOR);
	}

	applyTransforms(layer: Layers, viewMatrix: mat4) {
		const l = this.layers.get(layer)!;
		if (l.translate[0] != 0 || l.translate[1] != 0 || l.translate[2] != 0) {
			mat4.translate(viewMatrix, viewMatrix, l.translate);
		}
		if (l.rotate != 0) {
			const negRot = vec3.clone(l.rotationOrigin);
			vec3.negate(negRot, negRot);
			mat4.translate(viewMatrix, viewMatrix, l.rotationOrigin);
			mat4.rotate(viewMatrix, viewMatrix, glMatrix.toRadian(l.rotate), [0, 0, 1]);
			mat4.translate(viewMatrix, viewMatrix, negRot);
		}
	}

	getBuffer(renderType: RenderTypes) {
		return this.buffers.get(renderType)!;
	}

	length(layer: Layers, renderType: RenderTypes) {
		return this.vertexes.get(layer)![renderType];
	}
}

export class GlDraw extends BaseDraw {
	gl!: WebGL2RenderingContext;
	clientWidth!: number;
	clientHeight!: number;
	triProgram!: {
		program: WebGLProgram;
		attribLocations: {
			position: number;
			mask: number;
			uvPosition: number;
		};
		uniformLocations: {
			projectionMatrix: WebGLUniformLocation;
			modelViewMatrix: WebGLUniformLocation;
			normalMatrix: WebGLUniformLocation;
			textureSampler: WebGLUniformLocation;
			normalSampler: WebGLUniformLocation;
			lightDirection: WebGLUniformLocation;
			lightColor: WebGLUniformLocation;
			ambientLight: WebGLUniformLocation;
		};
	};
	lineProgram!: {
		program: WebGLProgram;
		attribLocations: {
			position: number;
			color: number;
		};
		uniformLocations: {
			projectionMatrix: WebGLUniformLocation;
			modelViewMatrix: WebGLUniformLocation;
		};
	};
	textures!: {
		pieces: WebGLTexture;
		pieceNormals: WebGLTexture;
	};
	state!: {
		dirShift: number;
		dirTimer: number;
		pauseFade: number;
	};
	layers: LayerManager;

	constructor(canvas: HTMLCanvasElement) {
		super(canvas);

		this.layers = new LayerManager();
		this.gl = this.canvas.getContext("webgl2", {
			premultipliedAlpha: false,
		})!;
		this.initGl();

		// const ele = this.canvas.parentElement!;
		// ele.addEventListener("mousemove", (e) => {
		// 	this.state.mouseX = e.clientX / ele.clientWidth;
		// 	this.state.mouseY = e.clientY / ele.clientHeight;
		// });
	}

	reset() {
		super.reset();

		this.canvas.width = this.grid * (this.sw + this.logic.gameDef.maxPieceWidth * 2 + 4);
		this.canvas.height = this.grid * (this.sh + 2 + 2);

		this.clientWidth = this.canvas.clientWidth;
		this.clientHeight = this.canvas.clientHeight;

		this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);

		this.state = {
			dirShift: 0,
			dirTimer: 0,
			pauseFade: 0,
		};
	}

	initGl() {
		const { gl } = this;

		if (gl === null) {
			throw new Error("Unable to initialize WebGL. Your browser or machine may not support it.");
		}

		// Set clear color to black, fully opaque
		gl.clearColor(0.0, 0.0, 0.0, 1.0);

		// Clear the color buffer with specified clear color
		gl.clear(gl.COLOR_BUFFER_BIT);

		// prettier-ignore
		const triProgram = this.initShaderProgram(
		// vertex
		/*glsl*/ `
			precision highp float;

			attribute vec4 aPosition;
    		attribute vec2 aUVPosition;
			attribute vec4 aMask;
		
			uniform mat4 uModelViewMatrix;
			uniform mat4 uProjectionMatrix;
		
			varying vec4 vMask;
			varying vec2 vUVPosition;

			void main(void) {
				gl_Position = uProjectionMatrix * uModelViewMatrix * aPosition;
				vUVPosition = vec2(aUVPosition.x, aUVPosition.y) / 4.0;
				vMask = aMask;
			}
		`,
		// fragement
		/*glsl*/`
			precision highp float;

			uniform mat4 uNormalMatrix;
			uniform sampler2D uTextureSampler;
			uniform sampler2D uNormalSampler;
			uniform vec3 uLightDirection;
			uniform vec3 uLightColor;
			uniform vec3 uAmbientLight;
			
			varying vec4 vMask;
			varying vec2 vUVPosition;

			void main(void) {
				vec3 vertexNormal = texture2D(uNormalSampler, vUVPosition).xyz;
				vec4 transformedNormal = uNormalMatrix * vec4(vertexNormal, 1.0);
				float directional = max(dot(transformedNormal.xyz, uLightDirection), 0.0);
				
				vec3 light = uAmbientLight + (uLightColor * directional);
				vec4 texel = texture2D(uTextureSampler, vUVPosition);

				gl_FragColor = vec4(texel.rgb * light.rgb, texel.a * vMask.a);
			}
		`);
		this.triProgram = {
			program: triProgram,
			attribLocations: {
				position: gl.getAttribLocation(triProgram, "aPosition"),
				uvPosition: gl.getAttribLocation(triProgram, "aUVPosition"),
				mask: gl.getAttribLocation(triProgram, "aMask"),
			},
			uniformLocations: {
				// general
				projectionMatrix: gl.getUniformLocation(triProgram, "uProjectionMatrix")!,
				modelViewMatrix: gl.getUniformLocation(triProgram, "uModelViewMatrix")!,
				// texture
				textureSampler: gl.getUniformLocation(triProgram, "uTextureSampler")!,
				normalMatrix: gl.getUniformLocation(triProgram, "uNormalMatrix")!,
				normalSampler: gl.getUniformLocation(triProgram, "uNormalSampler")!,
				// light
				lightDirection: gl.getUniformLocation(triProgram, "uLightDirection")!,
				lightColor: gl.getUniformLocation(triProgram, "uLightColor")!,
				ambientLight: gl.getUniformLocation(triProgram, "uAmbientLight")!,
			},
		};

		// prettier-ignore
		const lineProgram = this.initShaderProgram(
		// vertex
		/*glsl*/ `
			precision mediump float;

			attribute vec4 aPosition;
			attribute vec4 aColor;
		
			uniform mat4 uModelViewMatrix;
			uniform mat4 uProjectionMatrix;
		
			varying vec4 vColor;

			void main(void) {
				gl_Position = uProjectionMatrix * uModelViewMatrix * aPosition;
				vColor = aColor;
			}
		`,
		// fragement
		/*glsl*/`
			precision mediump float;

			varying vec4 vColor;

			void main(void) {
				gl_FragColor = vColor;
			}
		`);
		this.lineProgram = {
			program: lineProgram,
			attribLocations: {
				position: gl.getAttribLocation(lineProgram, "aPosition"),
				color: gl.getAttribLocation(lineProgram, "aColor"),
			},
			uniformLocations: {
				projectionMatrix: gl.getUniformLocation(lineProgram, "uProjectionMatrix")!,
				modelViewMatrix: gl.getUniformLocation(lineProgram, "uModelViewMatrix")!,
			},
		};

		this.textures = {
			pieces: this.loadTexture("./img/pieces.png"),
			pieceNormals: this.loadTexture("./img/pieces_normal.png"),
		};

		// @ts-expect-error we fill this out later
		this.buffers = {};
	}

	/**
	 * Creates a shader of the given type, uploads the source and compiles it.
	 */
	loadShader(type: number, source: string) {
		const gl = this.gl;
		const shader = gl.createShader(type)!;

		gl.shaderSource(shader, source);
		gl.compileShader(shader);

		if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
			// todo: probably don't alert
			alert(`An error occurred compiling the shaders: ${gl.getShaderInfoLog(shader)}`);
			gl.deleteShader(shader);
			throw 0;
		}

		return shader;
	}

	initShaderProgram(vsSource: string, fsSource: string) {
		const gl = this.gl;
		const vertexShader = this.loadShader(gl.VERTEX_SHADER, vsSource);
		const fragmentShader = this.loadShader(gl.FRAGMENT_SHADER, fsSource);

		const shaderProgram = gl.createProgram();
		gl.attachShader(shaderProgram, vertexShader);
		gl.attachShader(shaderProgram, fragmentShader);
		gl.linkProgram(shaderProgram);

		// If creating the shader program failed, alert
		if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
			alert(`Unable to initialize the shader program: ${gl.getProgramInfoLog(shaderProgram)}`);
			throw 0;
		}

		return shaderProgram;
	}

	loadTexture(url: string) {
		const { gl } = this;

		const texture = gl.createTexture();
		gl.bindTexture(gl.TEXTURE_2D, texture);

		// temporarily load a blue pixel while we wait for textures to load
		const level = 0;
		const internalFormat = gl.RGBA;
		const srcFormat = gl.RGBA;
		const srcType = gl.UNSIGNED_BYTE;
		gl.texImage2D(
			gl.TEXTURE_2D,
			level,
			internalFormat,
			1, // width
			1, // height
			0, // border
			srcFormat,
			srcType,
			new Uint8Array([0, 0, 255, 255]),
		);

		const image = new Image();
		image.onload = () => {
			gl.bindTexture(gl.TEXTURE_2D, texture);
			gl.texImage2D(gl.TEXTURE_2D, level, internalFormat, srcFormat, srcType, image);

			if (isPowerOf2(image.width) && isPowerOf2(image.height)) {
				gl.generateMipmap(gl.TEXTURE_2D);
			}
		};
		image.src = url;

		return texture;
	}

	setAttr4fv(attr: number, buffer: WebGLBuffer) {
		const { gl } = this;
		gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
		gl.vertexAttribPointer(attr, 4, gl.FLOAT, false, 0, 0);
		gl.enableVertexAttribArray(attr);
	}

	setAttr2fv(attr: number, buffer: WebGLBuffer) {
		const { gl } = this;
		gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
		gl.vertexAttribPointer(attr, 2, gl.FLOAT, false, 0, 0);
		gl.enableVertexAttribArray(attr);
	}

	private drawPieceState(piece: PieceState, a = 1.0) {
		const {
			sh,
			logic: {
				gameDef,
				gameDef: {
					settings: { boardSize },
				},
			},
		} = this;

		const yStart = boardSize[1] - sh;

		for (let y = 0; y < piece.data.height; y++) {
			for (let x = 0; x < piece.data.width; x++) {
				const p = piece.data.atXY(x, y)!;
				if (p !== 0) {
					const [u, v] = gameDef.getPiece(p).uv;

					this.drawBlock(piece.x + x, piece.y - yStart + 1 + y, u, v, a);
				}
			}
		}
	}

	private drawPiece(piece: Piece, offsetX: number, offsetY: number, grid = false) {
		const {
			logic: { gameDef },
		} = this;

		const topLeft = gameDef.topLeftMap.get(piece.index)!;
		for (let y = topLeft[1]; y < piece.data.height; y++) {
			for (let x = topLeft[0]; x < piece.data.width; x++) {
				const p = piece.data.atXY(x, y)!;
				if (p != 0) {
					const [u, v] = gameDef.getPiece(p).uv;
					const xx = offsetX + x - topLeft[0];
					const yy = offsetY + y - topLeft[1];

					this.drawBlock(xx, yy - gameDef.maxPieceHeight + 1, u, v);
					if (grid) this.drawRect(xx, yy);
				}
			}
		}
	}

	private drawBoard(playfield: ArrayMatrix<number>, a = 1.0) {
		const {
			sh,
			sw,
			logic: {
				gameDef,
				gameDef: {
					settings: { boardSize },
				},
			},
		} = this;

		let yStart = boardSize[1] - sh;
		let yOffset = 0;
		
		if (boardSize[1] > sh) {
			yStart -= 2;
			yOffset -= 2;
		}

		for (let y = yStart; y < boardSize[1]; y++) {
			for (let x = 0; x < sw; x++) {
				const p = playfield.atXY(x, y)!;
				if (p == 0) continue;
				
				const [u, v] = gameDef.getPiece(p).uv;
				this.drawBlock(x, y - yStart + 1 + yOffset, u, v, a);
			}
		}
	}

	drawBlock(x: number, y: number, u: number, v: number, a = 1.0) {
		y = -y;

		// basically the size of the piece
		const l1 = 0.0;
		const h1 = 1.0;

		this.layers.addPBRTriVertexes(6);

		// prettier-ignore
		this.layers.pushPBRTriXY(
			x + l1, y + l1, x + h1, y + l1, x + l1, y + h1, // bottom left
			x + l1, y + h1, x + h1, y + h1, x + h1, y + l1, // top right
		)

		// uv bodge factor to dodge seams
		const l2 = 0.02;
		const h2 = 0.98;

		// prettier-ignore
		this.layers.pushPBRTriUV(
			u + h2, v + h2, u + l2, v + h2, u + h2, v + l2, // bottom left
			u + h2, v + l2, u + l2, v + l2, u + l2, v + h2, // top right
		)

		// prettier-ignore
		this.layers.pushPBRTriMask(
			1.0, 1.0, 1.0, a,  1.0, 1.0, 1.0, a,  1.0, 1.0, 1.0, a,
			1.0, 1.0, 1.0, a,  1.0, 1.0, 1.0, a,  1.0, 1.0, 1.0, a,
		);
	}

	drawRect(x: number, y: number, w = 1.0, h = 1.0, r = 1.0, g = 1.0, b = 1.0, a = 0.2) {
		y = -y;

		// z here is a fudge factor
		const z = 0.01;
		w -= z;
		h -= z;

		this.layers.addLineVertexes(8);

		// prettier-ignore
		this.layers.pushLineXY(
			x + z, y + z,  x + w, y + z, // bottom
			x + w, y + z,  x + w, y + h, // right
			x + w, y + h,  x + z, y + h, // top
			x + z, y + h,  x + z, y + z, // left
		);

		// prettier-ignore
		this.layers.pushLineColor(
			r, g, b, a,  r, g, b, a, 
			r, g, b, a,  r, g, b, a, 
			r, g, b, a,  r, g, b, a, 
			r, g, b, a,  r, g, b, a, 
		);
	}

	drawFilledRect(x: number, y: number, w = 1.0, h = 1.0, r = 1.0, g = 1.0, b = 1.0, a = 0.2) {
		y = -y;

		// z here is a fudge factor
		const z = 0.01;
		w -= z;
		h -= z;

		this.layers.addTriVertexes(6);

		// prettier-ignore
		this.layers.pushTriXY(
			x + z, y + z,  x + w, y + z,  x + z, y + h, // bottom left
			x + z, y + h,  x + w, y + h,  x + w, y + z, // top right
		)

		// prettier-ignore
		this.layers.pushTriColor(
			r, g, b, a,  r, g, b, a,  r, g, b, a, 
			r, g, b, a,  r, g, b, a,  r, g, b, a, 
		);
	}

	fillBoardBuffers() {
		const {
			logic: {
				gameDef: {
					settings: { boardSize },
				},
			},
			sw,
			sh,
		} = this;

		this.layers.use(Layers.BOARD);
		// draw the tetris pieces
		this.drawBoard(this.logic.ghostboard, 0.4);
		this.drawBoard(this.logic.gameboard.pieces);

		if (!this.logic.activePiece.invalid) {
			const piece = this.logic.activePiece;
			const ghostPiece = this.logic.activePiece.copy().hardDrop();

			this.drawPieceState(ghostPiece, 0.4);
			this.drawPieceState(piece);
		}

		this.layers.use(Layers.GRID);
		// draw the grid
		const yStart = boardSize[1] - sh;
		for (let y = yStart; y < boardSize[1]; y++) {
			for (let x = 0; x < sw; x++) {
				this.drawRect(x, y - yStart + 1);
			}
		}
		this.layers.use(Layers.UI);
		this.drawRect(0, 0, sw, -sh, 1.0, 1.0, 1.0, 0.8);
	}

	fillUIBuffers() {
		const {
			logic: { gameDef },
			sw,
		} = this;

		this.layers.use(Layers.UI);
		const queue = gameDef.randomizer.peek(gameDef.settings.queueLength).map((v) => gameDef.getPiece(v)!);
		let y = -0.25;
		for (const piece of queue) {
			y += gameDef.maxPieceHeight + 0.5;
			this.drawPiece(piece, sw + 1, y);
		}
		this.drawRect(sw + 1 - 0.25, 0, gameDef.maxPieceWidth + 0.5, -y - 0.25, 1.0, 1.0, 1.0, 0.8);

		const holdPiece = this.logic.holdPiece;
		if (holdPiece != 0) {
			this.drawPiece(gameDef.getPiece(holdPiece)!, -gameDef.maxPieceWidth - 1, gameDef.maxPieceHeight + 0.25);
		}
		this.drawRect(
			-gameDef.maxPieceWidth - 1 - 0.25,
			0,
			gameDef.maxPieceWidth + 0.5,
			-gameDef.maxPieceHeight - 0.5,
			1.0,
			1.0,
			1.0,
			0.8,
		);

		this.layers.use(Layers.GRID);
		const failTimer = this.logic.state.failTimer;
		if (failTimer > 0) {
			this.drawFilledRect(0, this.sh, this.sw, (this.sh * this.logic.state.failTimer) / 60, 1.0, 0.0, 0.0, 0.1);
		}

		this.layers.use(Layers.UI);
		if (this.state.pauseFade > 0) {
			this.drawFilledRect(0, this.sh, this.sw, this.sh, 0.1, 0.1, 0.1, 0.5 * (this.state.pauseFade / 10));
		}
	}

	createBuffer(data: number[], usage: GLenum) {
		const gl = this.gl;

		const buffer = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), usage);

		return buffer;
	}

	drawScene() {
		const { gl, triProgram, lineProgram, logic: { gameDef } } = this;

		gl.clearColor(0.0, 0.0, 0.0, 1.0); // clear to black, fully opaque
		gl.clearDepth(1.0); // clear everything
		gl.enable(gl.DEPTH_TEST); // enable depth testing
		gl.depthFunc(gl.LEQUAL); // near things obscure far things

		// clear the canvas
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

		gl.enable(gl.BLEND);
		gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

		const zNear = 0.1;
		const zFar = 100.0;
		const projectionMatrix = mat4.create();

		// layout is lr margins of the max piece width + 2, and dimensions of sw by sh + 2 + 2

		const left = -gameDef.maxPieceWidth - 2;
		const right = this.sw + gameDef.maxPieceWidth + 2;
		const top = -this.sh - 2;
		const bottom = 3;

		mat4.ortho(projectionMatrix, left, right, top, bottom, zNear, zFar);

		const modelViewMatrix = mat4.create();
		mat4.translate(modelViewMatrix, modelViewMatrix, [0, 0, -1.0]);
		// mat4.rotate(modelViewMatrix, modelViewMatrix, 0, [0, 0, 1]);

		const normalMatrix = mat4.create();
		mat4.invert(normalMatrix, modelViewMatrix);
		mat4.transpose(normalMatrix, normalMatrix);

		// const lightPos = [1 - this.state.mouseX * 2, 1 - this.state.mouseY * 2, 0.75];
		const lightPos = [0.8, 0.8, 0.75];
		vec3.normalize(lightPos, lightPos);

		this.fillBoardBuffers();
		this.fillUIBuffers();

		this.layers.commit(this.gl);

		this.layers.use(Layers.BOARD);
		this.layers.translate([this.state.dirShift, 0, 0]);
		this.layers.use(Layers.GRID);
		this.layers.translate([this.state.dirShift, 0, 0]);

		// set up everything for the tris
		gl.useProgram(triProgram.program);

		this.setAttr2fv(triProgram.attribLocations.position, this.layers.getBuffer(RenderTypes.PBR_XY));
		this.setAttr2fv(triProgram.attribLocations.uvPosition, this.layers.getBuffer(RenderTypes.PBR_UV));
		this.setAttr4fv(triProgram.attribLocations.mask, this.layers.getBuffer(RenderTypes.PBR_MASK));

		// set the shader uniforms
		gl.uniformMatrix4fv(triProgram.uniformLocations.projectionMatrix, false, projectionMatrix);
		gl.uniformMatrix4fv(triProgram.uniformLocations.normalMatrix, false, normalMatrix);
		gl.uniform3fv(triProgram.uniformLocations.lightDirection, lightPos);
		gl.uniform3fv(triProgram.uniformLocations.ambientLight, [0.1, 0.1, 0.1]);
		gl.uniform3fv(triProgram.uniformLocations.lightColor, [1, 1, 1]);

		// load the texture into WebGL
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, this.textures.pieces);
		gl.uniform1i(triProgram.uniformLocations.textureSampler, 0);

		gl.activeTexture(gl.TEXTURE1);
		gl.bindTexture(gl.TEXTURE_2D, this.textures.pieceNormals);
		gl.uniform1i(triProgram.uniformLocations.normalSampler, 1);

		// draw the board (tris)
		let triIndex = 0;
		const triViewMatrix = mat4.clone(modelViewMatrix);
		for (let i = 0; i < Layers.LENGTH; i++) {
			const length = this.layers.length(i, RenderTypes.PBR_XY);

			if (length != 0) {
				const viewMatrix = mat4.clone(triViewMatrix);
				this.layers.applyTransforms(i, viewMatrix);

				gl.uniformMatrix4fv(triProgram.uniformLocations.modelViewMatrix, false, viewMatrix);
				gl.drawArrays(gl.TRIANGLES, triIndex, length);
			}

			mat4.translate(triViewMatrix, triViewMatrix, [0, 0, -1]);
			triIndex += length;
		}

		// set up everything for the lines
		gl.useProgram(lineProgram.program);

		// draw lines 0.5 unit behind the rest
		mat4.translate(modelViewMatrix, modelViewMatrix, [0, 0, -0.5]);

		this.setAttr2fv(lineProgram.attribLocations.position, this.layers.getBuffer(RenderTypes.SIMPLE_XY));
		this.setAttr4fv(lineProgram.attribLocations.color, this.layers.getBuffer(RenderTypes.SIMPLE_COLOR));

		gl.uniformMatrix4fv(lineProgram.uniformLocations.projectionMatrix, false, projectionMatrix);

		// draw the board (lines)
		let simpleIndex = 0;
		const simpleViewMatrix = mat4.clone(modelViewMatrix);
		for (let i = 0; i < Layers.LENGTH; i++) {
			const length = this.layers.length(i, RenderTypes.LINE_XY);

			if (length != 0) {
				const viewMatrix = mat4.clone(simpleViewMatrix);
				this.layers.applyTransforms(i, viewMatrix);

				gl.uniformMatrix4fv(lineProgram.uniformLocations.modelViewMatrix, false, viewMatrix);
				gl.drawArrays(gl.LINES, simpleIndex, length);
			}

			mat4.translate(simpleViewMatrix, simpleViewMatrix, [0, 0, -1]);
			simpleIndex += length;
		}

		// draw the board (tris)
		mat4.copy(simpleViewMatrix, modelViewMatrix);
		for (let i = 0; i < Layers.LENGTH; i++) {
			const length = this.layers.length(i, RenderTypes.TRI_XY);

			if (length != 0) {
				const viewMatrix = mat4.clone(simpleViewMatrix);
				this.layers.applyTransforms(i, viewMatrix);

				gl.uniformMatrix4fv(lineProgram.uniformLocations.modelViewMatrix, false, viewMatrix);
				gl.drawArrays(gl.TRIANGLES, simpleIndex, length);
			}

			mat4.translate(simpleViewMatrix, simpleViewMatrix, [0, 0, -1]);
			simpleIndex += length;
		}
	}

	frame(deltaTime: number) {
		this.layers.clear(Layers.BOARD);
		this.layers.clear(Layers.GRID);
		this.layers.clear(Layers.UI);

		if (!1) {
			// todo: idk how i feel about this effect...
			const factor = 0.2;
			const max = 0.025;
			const delay = 4;
			let moved = false;
			if (!this.logic.activePiece.invalid) {
				const p = this.logic.activePiece.copy();

				if (this.logic.input.isPressed(Keys.MoveLeft)) {
					p.x -= 1;
					if (p.parent.pieceIntersecting(p)) {
						if (this.state.dirTimer > delay) {
							this.state.dirShift -= factor * deltaTime;
							this.state.dirShift = Math.max(this.state.dirShift, -max);
						} else {
							this.state.dirTimer += 1;
						}
						moved = true;
					}
				} else if (this.logic.input.isPressed(Keys.MoveRight)) {
					p.x += 1;
					if (p.parent.pieceIntersecting(p)) {
						if (this.state.dirTimer > delay) {
							this.state.dirShift += factor * deltaTime;
							this.state.dirShift = Math.min(this.state.dirShift, max);
						} else {
							this.state.dirTimer += 1;
						}
						moved = true;
					}
				}
			}
			if (!moved) {
				if (this.state.dirShift > 0) {
					this.state.dirShift -= factor * deltaTime;
				} else if (this.state.dirShift < 0) {
					this.state.dirShift += factor * deltaTime;
				}
				this.state.dirTimer = 0;
			}
		}

		if (this.logic.paused) {
			this.state.pauseFade = 10;
		} else if (this.state.pauseFade > 0) {
			this.state.pauseFade -= 1;
		}

		this.drawScene();
	}

	clear(): void {
		const { gl } = this;

		gl.clearColor(0.0, 0.0, 0.0, 1.0); // Clear to black, fully opaque
		gl.clearDepth(1.0); // Clear everything
		gl.enable(gl.DEPTH_TEST); // Enable depth testing
		gl.depthFunc(gl.LEQUAL); // Near things obscure far things

		// Clear the canvas
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
	}
}
