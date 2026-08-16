import { mat4 } from "gl-matrix";
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
	programInfo!: {
		program: WebGLProgram;
		attribLocations: {
			vertexPosition: number;
			vertexColor: number;
			textureCoord: number;
		};
		uniformLocations: {
			projectionMatrix: WebGLUniformLocation;
			modelViewMatrix: WebGLUniformLocation;
			normalMatrix: WebGLUniformLocation;
			textureSampler: WebGLUniformLocation;
			normalSampler: WebGLUniformLocation;
			directionalVector: WebGLUniformLocation;
		};
	};
	buffers!: {
		position: WebGLBuffer;
		mask: WebGLBuffer;
		textureCoord: WebGLBuffer;
	};
	textures!: {
		pieces: WebGLTexture;
		pieceNormals: WebGLTexture;
	};
	state!: {
		squareRotation: number;
		vertexes: number;
		positions: number[];
		textureCoords: number[];
		masks: number[];
		mouseX: number;
		mouseY: number;
	};

	constructor(canvas: HTMLCanvasElement, holdCanvas: HTMLCanvasElement, queueCanvas: HTMLCanvasElement) {
		super(canvas, holdCanvas, queueCanvas);

		this.gl = this.canvas.getContext("webgl2")!;
		this.initGl();

		const ele = this.canvas.parentElement!;
		ele.addEventListener("mousemove", (e) => {
			this.state.mouseX = e.clientX / ele.clientWidth;
			this.state.mouseY = e.clientY / ele.clientHeight;
		})
	}

	reset() {
		super.reset();

		this.clientWidth = this.canvas.clientWidth;
		this.clientHeight = this.canvas.clientHeight;

		this.state = {
			squareRotation: 0,
			vertexes: 0,
			positions: [],
			textureCoords: [],
			masks: [],
			mouseX: 0,
			mouseY: 0,
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

		const vsSource = /*glsl*/ `
			precision mediump float;
			attribute vec4 aVertexPosition;
    		attribute vec2 aTextureCoord;
			attribute vec4 aVertexColor;
		
			uniform mat4 uModelViewMatrix;
			uniform mat4 uProjectionMatrix;
		
			varying vec4 vColor;
			varying vec2 vTextureCoord;

			void main(void) {
				gl_Position = uProjectionMatrix * uModelViewMatrix * aVertexPosition;
				vTextureCoord = aTextureCoord;
				vColor = aVertexColor;
			}
		`;

		const fsSource = /*glsl*/ `
			precision mediump float;

			uniform mat4 uNormalMatrix;
			uniform sampler2D uTextureSampler;
			uniform sampler2D uNormalSampler;
			uniform vec3 uDirectionalVector;
			
			varying vec4 vColor;
			varying vec2 vTextureCoord;

			void main(void) {
				vec3 ambientLight = vec3(0.3, 0.3, 0.3);
				vec3 directionalLightColor = vec3(1, 1, 1);
				vec3 directionalVector = normalize(uDirectionalVector);

				vec3 vertexNormal = texture2D(uNormalSampler, vTextureCoord.xy / 4.0).xyz;

				vec4 transformedNormal = uNormalMatrix * vec4(vertexNormal, 1.0);

				float directional = max(dot(transformedNormal.xyz, directionalVector), 0.0);
				vec3 light = ambientLight + (directionalLightColor * directional);

				vec4 texel = texture2D(uTextureSampler, vTextureCoord.xy / 4.0);

				gl_FragColor = vec4(texel.rgb * light.rgb, texel.a * vColor.a);
			}
		`;

		// Initialize a shader program; this is where all the lighting
		// for the vertices and so forth is established.
		const shaderProgram = this.initShaderProgram(vsSource, fsSource);

		// Collect all the info needed to use the shader program.
		// Look up which attributes our shader program is using
		// for aVertexPosition, aVertexColor and also
		// look up uniform locations.
		this.programInfo = {
			program: shaderProgram,
			attribLocations: {
				vertexPosition: gl.getAttribLocation(shaderProgram, "aVertexPosition"),
				vertexColor: gl.getAttribLocation(shaderProgram, "aVertexColor"),
				textureCoord: gl.getAttribLocation(shaderProgram, "aTextureCoord"),
			},
			uniformLocations: {
				projectionMatrix: gl.getUniformLocation(shaderProgram, "uProjectionMatrix")!,
				modelViewMatrix: gl.getUniformLocation(shaderProgram, "uModelViewMatrix")!,
				normalMatrix: gl.getUniformLocation(shaderProgram, "uNormalMatrix")!,
				textureSampler: gl.getUniformLocation(shaderProgram, "uTextureSampler")!,
				normalSampler: gl.getUniformLocation(shaderProgram, "uNormalSampler")!,
				directionalVector: gl.getUniformLocation(shaderProgram, "uDirectionalVector")!,
			},
		};

		this.textures = {
			pieces: this.loadTexture("./img/pieces.png"),
			pieceNormals: this.loadTexture("./img/pieces_normal.png"),
		};
	}

	/**
	 * Creates a shader of the given type, uploads the source and
	 * compiles it.
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

		// Because images have to be downloaded over the internet
		// they might take a moment until they are ready.
		// Until then put a single pixel in the texture so we can
		// use it immediately. When the image has finished downloading
		// we'll update the texture with the contents of the image.
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
			new Uint8Array([0, 0, 255, 255]), // opaque blue
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

	setColorAttribute() {
		const { gl, programInfo, buffers } = this;
		gl.bindBuffer(gl.ARRAY_BUFFER, buffers.mask);
		gl.vertexAttribPointer(programInfo.attribLocations.vertexColor, 4, gl.FLOAT, false, 0, 0);
		gl.enableVertexAttribArray(programInfo.attribLocations.vertexColor);
	}

	setPositionAttribute() {
		const { gl, programInfo, buffers } = this;

		gl.bindBuffer(gl.ARRAY_BUFFER, buffers.position);
		gl.vertexAttribPointer(
			programInfo.attribLocations.vertexPosition,
			2, // pull out 2 values per iteration
			gl.FLOAT, // the data in the buffer is 32bit floats
			false, // don't normalize
			0, // how many bytes to get from one set of values to the next
			0, // how many bytes inside the buffer to start from
		);
		gl.enableVertexAttribArray(programInfo.attribLocations.vertexPosition);
	}

	setTextureAttribute() {
		const { gl, programInfo, buffers } = this;

		gl.bindBuffer(gl.ARRAY_BUFFER, buffers.textureCoord);
		gl.vertexAttribPointer(
			programInfo.attribLocations.textureCoord,
			2, // every coordinate composed of 2 values
			gl.FLOAT, // the data in the buffer is 32bit floats
			false, // don't normalize
			0, // how many bytes to get from one set of values to the next
			0, // how many bytes inside the buffer to start from
		);
		gl.enableVertexAttribArray(programInfo.attribLocations.textureCoord);
	}

	private drawPieceState(piece: PieceState, a = 1.0) {
		const {
			sh,
			logic: { gameDef },
		} = this;

		for (let y = 0; y < piece.data.height; y++) {
			for (let x = 0; x < piece.data.width; x++) {
				const b = piece.data.atXY(x, y);
				if (b !== 0) {
					const [u, v] = gameDef.uvs.get(piece.piece.name) ?? gameDef.uvs.get(gameDef.subpieces.get(b)!)!;

					this.drawBlock(piece.x + x, piece.y - sh + y, u, v, a);
				}
			}
		}
	}

	private drawPiece(piece: Piece, offsetX: number, offsetY: number) {
		const {
			logic: { gameDef },
		} = this;

		const topLeft = this.topLeftMap.get(piece.name)!;
		for (let y = topLeft[1]; y < piece.matrix.height; y++) {
			for (let x = topLeft[0]; x < piece.matrix.width; x++) {
				const b = piece.matrix.atXY(x, y);
				if (b != 0) {
					const [u, v] = gameDef.uvs.get(piece.name) ?? gameDef.uvs.get(gameDef.subpieces.get(b)!)!;
					this.drawBlock(offsetX + (x - topLeft[0]), offsetY + (y - topLeft[1]), u, v);
				}
			}
		}
	}

	private drawBoard(playfield: ArrayMatrix<string>, height: number, a = 1.0) {
		const {
			grid,
			sh,
			sw,
			logic: { gameDef },
		} = this;
		// todo: display half of the row above the screen if boardSize is bigger than screenSize

		for (let y = sh; y < height; y++) {
			for (let x = 0; x < sw; x++) {
				const name = playfield.atXY(x, y);
				if (name == " ") continue;

				const [u, v] = gameDef.uvs.get(name)!;
				this.drawBlock(x, y - sh, u, v, a = 1.0);
			}
		}
	}

	drawBlock(x: number, y: number, u: number, v: number, a = 1.0) {
		y = -y;

		this.state.vertexes += 6;
		// prettier-ignore
		this.state.positions.push(
			x + 0.0, y + 0.0, x + 1.0, y + 0.0, x + 0.0, y + 1.0, // bottom left
			x + 0.0, y + 1.0, x + 1.0, y + 1.0, x + 1.0, y + 0.0, // top right
		)

		// prettier-ignore
		this.state.textureCoords.push(
			u + 0.0, v + 0.0, u + 1.0, v + 0.0, u + 0.0, v + 1.0, // bottom left
			u + 0.0, v + 1.0, u + 1.0, v + 1.0, u + 1.0, v + 0.0, // top right
		)

		// prettier-ignore
		this.state.masks.push(
			1.0, 1.0, 1.0, a,  1.0, 1.0, 1.0, a,  1.0, 1.0, 1.0, a,
			1.0, 1.0, 1.0, a,  1.0, 1.0, 1.0, a,  1.0, 1.0, 1.0, a,
		);
	}

	initBuffers() {
		const boardSize = this.logic.gameDef.settings.boardSize;
		this.drawBoard(this.logic.ghostboard, boardSize[1], 0.4);
		this.drawBoard(this.logic.gameboard, boardSize[1]);

		if (!this.logic.activePiece.invalid) {
			const piece = this.logic.activePiece;
			const ghostPiece = this.logic.activePiece.copy().hardDrop();

			this.drawPieceState(ghostPiece, 0.4);

			this.drawPieceState(piece);
		}

		return {
			position: this.createBuffer(this.state.positions),
			textureCoord: this.createBuffer(this.state.textureCoords),
			mask: this.createBuffer(this.state.masks),
		};
	}

	createBuffer(data: number[]) {
		const gl = this.gl;

		const buffer = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);

		return buffer;
	}

	drawScene() {
		const { gl, programInfo } = this;

		gl.clearColor(0.0, 0.0, 0.0, 1.0); // Clear to black, fully opaque
		gl.clearDepth(1.0); // Clear everything
		gl.enable(gl.DEPTH_TEST); // Enable depth testing
		gl.depthFunc(gl.LEQUAL); // Near things obscure far things

		// Clear the canvas
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

		const zNear = 0.1;
		const zFar = 100.0;
		const projectionMatrix = mat4.create();

		mat4.ortho(projectionMatrix, 0, this.sw, -this.sh + 1, 0, zNear, zFar)

		const modelViewMatrix = mat4.create();
		mat4.translate(
			modelViewMatrix, // destination matrix
			modelViewMatrix, // matrix to translate
			[0, 0, -1.0], // amount to translate
		);
		// mat4.rotate(
		// 	modelViewMatrix, // destination matrix
		// 	modelViewMatrix, // matrix to rotate
		// 	0, // amount to rotate in radians
		// 	[0, 0, 1],
		// ); // axis to rotate around

		const normalMatrix = mat4.create();
		mat4.invert(normalMatrix, modelViewMatrix);
		mat4.transpose(normalMatrix, normalMatrix);

		// [ 0.85, 0.8, 0.75 ]
		const lightPos = [1 - (this.state.mouseX * 2), 1 - (this.state.mouseY * 2), 0.75];

		this.setPositionAttribute();
		this.setTextureAttribute();
		this.setColorAttribute();

		// Tell WebGL to use our program when drawing
		gl.useProgram(programInfo.program);

		// Set the shader uniforms
		gl.uniformMatrix4fv(programInfo.uniformLocations.projectionMatrix, false, projectionMatrix);
		gl.uniformMatrix4fv(programInfo.uniformLocations.modelViewMatrix, false, modelViewMatrix);
		gl.uniformMatrix4fv(programInfo.uniformLocations.normalMatrix, false, normalMatrix);
		gl.uniform3fv(programInfo.uniformLocations.directionalVector, lightPos);

		// Load the texture into WebGL
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, this.textures.pieces);
		gl.uniform1i(programInfo.uniformLocations.textureSampler, 0);

		gl.activeTexture(gl.TEXTURE1);
		gl.bindTexture(gl.TEXTURE_2D, this.textures.pieceNormals);
		gl.uniform1i(programInfo.uniformLocations.normalSampler, 1);

		{
			gl.drawArrays(gl.TRIANGLES, 0, this.state.vertexes);
		}
	}

	frame(deltaTime: number) {
		this.state.vertexes = 0;
		this.state.positions = [];
		this.state.textureCoords = [];
		this.state.masks = [];

		this.buffers = this.initBuffers();

		this.drawScene();
		this.state.squareRotation += deltaTime;
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
