import { mat4, vec3 } from "gl-matrix";
import { BaseDraw } from "./BaseDraw";
import { PieceState } from "../PieceState";
import { Piece } from "../GameDef";
import { ArrayMatrix } from "../../utils/ArrayMatrix";

const isPowerOf2 = (value: number) => {
	return (value & (value - 1)) === 0;
};

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
	buffers!: {
		positions: WebGLBuffer;
		mask: WebGLBuffer;
		uvPostions: WebGLBuffer;
		simplePositions: WebGLBuffer;
		simpleColors: WebGLBuffer;
	};
	textures!: {
		pieces: WebGLTexture;
		pieceNormals: WebGLTexture;
	};
	state!: {
		triVertexes: number;
		positions: number[];
		uvPositions: number[];
		lineVertexes: number;
		linePositions: number[];
		lineColors: number[];
		rectVertexes: number;
		rectPositions: number[];
		rectColors: number[];
		masks: number[];
	};

	constructor(canvas: HTMLCanvasElement) {
		super(canvas);

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

		this.canvas.width = this.grid * (this.sw + this.maxPieceWidth * 2 + 4);
		this.canvas.height = this.grid * (this.sh + 2);

		this.clientWidth = this.canvas.clientWidth;
		this.clientHeight = this.canvas.clientHeight;

		this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);

		this.state = {
			triVertexes: 0,
			positions: [],
			uvPositions: [],
			masks: [],

			lineVertexes: 0,
			linePositions: [],
			rectPositions: [],
			rectVertexes: 0,
			lineColors: [],
			rectColors: [],
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
				const b = piece.data.atXY(x, y);
				if (b !== 0) {
					const [u, v] = gameDef.uvs.get(piece.piece.name) ?? gameDef.uvs.get(gameDef.subpieces.get(b)!)!;

					this.drawBlock(piece.x + x, piece.y - yStart + 1 + y, u, v, a);
				}
			}
		}
	}

	private drawPiece(piece: Piece, offsetX: number, offsetY: number, grid = false) {
		const {
			logic: { gameDef },
		} = this;

		const topLeft = this.topLeftMap.get(piece.name)!;
		for (let y = topLeft[1]; y < piece.matrix.height; y++) {
			for (let x = topLeft[0]; x < piece.matrix.width; x++) {
				const b = piece.matrix.atXY(x, y);
				if (b != 0) {
					const [u, v] = gameDef.uvs.get(piece.name) ?? gameDef.uvs.get(gameDef.subpieces.get(b)!)!;
					const xx = offsetX + x - topLeft[0];
					const yy = offsetY + y - topLeft[1];

					this.drawBlock(xx, yy - this.maxPieceHeight + 1, u, v);
					if (grid) this.drawRect(xx, yy);
				}
			}
		}
	}

	private drawBoard(playfield: ArrayMatrix<string>, a = 1.0) {
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
		// todo: display half of the row above the screen if boardSize is bigger than screenSize

		const yStart = boardSize[1] - sh;
		for (let y = yStart; y < boardSize[1]; y++) {
			for (let x = 0; x < sw; x++) {
				const name = playfield.atXY(x, y);
				if (name == " ") continue;

				const [u, v] = gameDef.uvs.get(name)!;
				this.drawBlock(x, y - yStart + 1, u, v, a);
			}
		}
	}

	drawBlock(x: number, y: number, u: number, v: number, a = 1.0) {
		y = -y;

		this.state.triVertexes += 6;

		// basically the size of the piece
		const l1 = 0.0;
		const h1 = 1.0;

		// prettier-ignore
		this.state.positions.push(
			x + l1, y + l1, x + h1, y + l1, x + l1, y + h1, // bottom left
			x + l1, y + h1, x + h1, y + h1, x + h1, y + l1, // top right
		)

		// uv bodge factor to dodge seams
		const l2 = 0.02;
		const h2 = 0.98;

		// prettier-ignore
		this.state.uvPositions.push(
			u + h2, v + h2, u + l2, v + h2, u + h2, v + l2, // bottom left
			u + h2, v + l2, u + l2, v + l2, u + l2, v + h2, // top right
		)

		// prettier-ignore
		this.state.masks.push(
			1.0, 1.0, 1.0, a,  1.0, 1.0, 1.0, a,  1.0, 1.0, 1.0, a,
			1.0, 1.0, 1.0, a,  1.0, 1.0, 1.0, a,  1.0, 1.0, 1.0, a,
		);
	}

	drawRect(x: number, y: number, w = 1.0, h = 1.0, r = 1.0, g = 1.0, b = 1.0, a = 0.2) {
		y = -y;

		this.state.lineVertexes += 8;

		// z here is a fudge factor
		const z = 0.01;
		w += z;

		// prettier-ignore
		this.state.linePositions.push(
			x + z, y + z,  x + w, y + z, // bottom
			x + w, y + z,  x + w, y + h, // right
			x + w, y + h,  x + z, y + h, // top
			x + z, y + h,  x + z, y + z, // left
		);

		// prettier-ignore
		this.state.lineColors.push(
			r, g, b, a,  r, g, b, a, 
			r, g, b, a,  r, g, b, a, 
			r, g, b, a,  r, g, b, a, 
			r, g, b, a,  r, g, b, a, 
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

		// draw the tetris pieces
		this.drawBoard(this.logic.ghostboard, 0.4);
		this.drawBoard(this.logic.gameboard);

		if (!this.logic.activePiece.invalid) {
			const piece = this.logic.activePiece;
			const ghostPiece = this.logic.activePiece.copy().hardDrop();

			this.drawPieceState(ghostPiece, 0.4);
			this.drawPieceState(piece);
		}

		// draw the grid
		const yStart = boardSize[1] - sh;
		for (let y = yStart; y < boardSize[1]; y++) {
			for (let x = 0; x < sw; x++) {
				this.drawRect(x, y - yStart + 1);
			}
		}
		this.drawRect(0, 0, sw, -sh, 1.0, 1.0, 1.0, 0.8);
	}

	fillUIBuffers() {
		const {
			logic: { gameDef },
			sw,
		} = this;

		const queue = gameDef.randomizer.peek(gameDef.settings.queueLength).map((v) => gameDef.pieces.get(v)!);
		let y = -0.25;
		for (const piece of queue) {
			y += this.maxPieceHeight + 0.5;
			this.drawPiece(piece, sw + 1, y);
		}
		this.drawRect(sw + 1 - 0.25, 0, this.maxPieceWidth + 0.5, -y - 0.25, 1.0, 1.0, 1.0, 0.8);

		const holdPiece = this.logic.holdPiece;
		if (holdPiece != " ") {
			this.drawPiece(gameDef.pieces.get(holdPiece)!, -this.maxPieceWidth - 1, this.maxPieceHeight + 0.25);
		}
		this.drawRect(
			-this.maxPieceWidth - 1 - 0.25,
			0,
			this.maxPieceWidth + 0.5,
			-this.maxPieceHeight - 0.5,
			1.0,
			1.0,
			1.0,
			0.8,
		);
	}

	createBuffer(data: number[], usage: GLenum) {
		const gl = this.gl;

		const buffer = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), usage);

		return buffer;
	}

	drawScene() {
		const { gl, triProgram, lineProgram } = this;

		gl.clearColor(0.0, 0.0, 0.0, 1.0); // clear to black, fully opaque
		gl.clearDepth(1.0); // clear everything
		gl.enable(gl.DEPTH_TEST); // enable depth testing
		gl.depthFunc(gl.LEQUAL); // near things obscure far things

		// clear the canvas
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

		const zNear = 0.1;
		const zFar = 100.0;
		const projectionMatrix = mat4.create();

		// layout is lr margins of the max piece width + 2, and dimensions of sw by sh + 2

		const left = -this.maxPieceWidth - 2;
		const right = this.sw + this.maxPieceWidth + 2;
		const top = -this.sh - 2;
		const bottom = 1;

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

		const boardViewMatrix = mat4.clone(modelViewMatrix);

		// set up everything for the tris
		gl.useProgram(triProgram.program);

		this.fillBoardBuffers();
		const boardTriVertexes = this.state.triVertexes;
		const boardLineVertexes = this.state.lineVertexes;
		const boardRectVertexes = this.state.rectVertexes;
		this.fillUIBuffers();
		const uiTriVertexes = this.state.triVertexes - boardTriVertexes;
		const uiLineVertexes = this.state.lineVertexes - boardLineVertexes;
		const uiRectVertexes = this.state.rectVertexes - boardRectVertexes;

		this.buffers.positions = this.createBuffer(this.state.positions, gl.DYNAMIC_DRAW);
		this.buffers.uvPostions = this.createBuffer(this.state.uvPositions, gl.DYNAMIC_DRAW);
		this.buffers.mask = this.createBuffer(this.state.masks, gl.DYNAMIC_DRAW);

		this.buffers.simplePositions = this.createBuffer(
			[...this.state.linePositions, ...this.state.rectPositions],
			gl.DYNAMIC_DRAW,
		);
		this.buffers.simpleColors = this.createBuffer(
			[...this.state.lineColors, ...this.state.rectColors],
			gl.DYNAMIC_DRAW,
		);

		this.setAttr4fv(triProgram.attribLocations.mask, this.buffers.mask);
		this.setAttr2fv(triProgram.attribLocations.uvPosition, this.buffers.uvPostions);
		this.setAttr2fv(triProgram.attribLocations.position, this.buffers.positions);

		// set the shader uniforms
		gl.uniformMatrix4fv(triProgram.uniformLocations.projectionMatrix, false, projectionMatrix);
		gl.uniformMatrix4fv(triProgram.uniformLocations.modelViewMatrix, false, boardViewMatrix);
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
		gl.drawArrays(gl.TRIANGLES, 0, boardTriVertexes);

		// reset the non-board transforms, draw the rest
		gl.uniformMatrix4fv(triProgram.uniformLocations.modelViewMatrix, false, modelViewMatrix);
		gl.drawArrays(gl.TRIANGLES, boardTriVertexes, uiTriVertexes);

		// set up everything for the lines
		gl.useProgram(lineProgram.program);

		// draw lines 1 unit behind the pieces
		mat4.translate(modelViewMatrix, modelViewMatrix, [0, 0, -1.0]);
		mat4.translate(boardViewMatrix, boardViewMatrix, [0, 0, -1.0]);

		this.setAttr2fv(lineProgram.attribLocations.position, this.buffers.simplePositions);
		this.setAttr4fv(lineProgram.attribLocations.color, this.buffers.simpleColors);

		gl.uniformMatrix4fv(lineProgram.uniformLocations.projectionMatrix, false, projectionMatrix);
		gl.uniformMatrix4fv(lineProgram.uniformLocations.modelViewMatrix, false, modelViewMatrix);

		// draw the board (lines)
		gl.drawArrays(gl.LINES, 0, boardLineVertexes);

		// draw the board (tris)
		gl.drawArrays(gl.TRIANGLES, boardLineVertexes + uiLineVertexes, boardRectVertexes);

		// reset the non-board transforms
		gl.uniformMatrix4fv(lineProgram.uniformLocations.modelViewMatrix, false, modelViewMatrix);
		
		// draw the rest (lines)
		gl.drawArrays(gl.LINES, boardLineVertexes, uiLineVertexes);
		// draw the rest (tris)
		gl.drawArrays(gl.TRIANGLES, boardLineVertexes + uiLineVertexes + boardRectVertexes, uiRectVertexes);

	}

	frame(deltaTime: number) {
		this.state = {
			triVertexes: 0,
			positions: [],
			uvPositions: [],
			masks: [],

			lineVertexes: 0,
			linePositions: [],
			lineColors: [],
			rectVertexes: 0,
			rectPositions: [],
			rectColors: [],
		};

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
