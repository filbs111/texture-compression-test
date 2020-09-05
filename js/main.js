//1 draw a quad to the screen
//2 use a texture. load or procedural. procedural gradient should be useful
//3 attempt generating dxt1. min=max colour and zeros for per pixel part should suffice.
//4 pull out correct min, max colours, set bits correctly
//5 benchmark it. have a go at some optimisation
//6 gpu implementation!

var shaderPrograms={};
var fsBuffers={};

var fsDeep = 1; //unused, but keep 3vec vertices for consistency with other projects.
var fsData = {
	vertices:[
		-1,-1,-fsDeep,
		-1,1,-fsDeep,
		1,-1,-fsDeep,
		1,1,-fsDeep
	],
	indices:[
		//0,1,2,
		0,2,1,
		//1,3,2
		1,2,3
	]
}


function init(){
    canvas = document.getElementById("glcanvas");

    initGL();
    console.log({gl});
    initShaders();
    initTexture();
    initBuffers();
    getLocationsForShaders();

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);   //maybe unnecessary
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor.apply(gl,[0,1,0,1]);  //green
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    drawStuff();
    console.log("drew stuff");
}

function initShaders(){
    shaderPrograms.flatcolor = loadShader("shader-basic-vs", "shader-flatcolor-fs");
    shaderPrograms.tex = loadShader("shader-basic-vs", "shader-tex-fs");
}

function initBuffers(){
    loadBufferData(fsBuffers, fsData);

    function loadBufferData(bufferObj, sourceData){
		bufferObj.vertexPositionBuffer = gl.createBuffer();
		bufferArrayData(bufferObj.vertexPositionBuffer, sourceData.vertices, sourceData.vertices_len || 3);
		if (sourceData.uvcoords){
			bufferObj.vertexTextureCoordBuffer= gl.createBuffer();
			bufferArrayData(bufferObj.vertexTextureCoordBuffer, sourceData.uvcoords, 2);
		}
		if (sourceData.velocities){	//for exploding objects
			bufferObj.vertexVelocityBuffer= gl.createBuffer();
			bufferArrayData(bufferObj.vertexVelocityBuffer, sourceData.velocities, 3);
		}
		if (sourceData.normals){
			bufferObj.vertexNormalBuffer= gl.createBuffer();
			bufferArrayData(bufferObj.vertexNormalBuffer, sourceData.normals, 3);
		}
		if (sourceData.tangents){
			bufferObj.vertexTangentBuffer= gl.createBuffer();
			bufferArrayData(bufferObj.vertexTangentBuffer, sourceData.tangents, 3);
		}
		if (sourceData.binormals){
			bufferObj.vertexBinormalBuffer= gl.createBuffer();
			bufferArrayData(bufferObj.vertexBinormalBuffer, sourceData.binormals, 3);
		}
		bufferObj.vertexIndexBuffer = gl.createBuffer();
		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, bufferObj.vertexIndexBuffer);
		gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(sourceData.indices), gl.STATIC_DRAW);
		bufferObj.vertexIndexBuffer.itemSize = 3;
		bufferObj.vertexIndexBuffer.numItems = sourceData.indices.length;
	}
}
function bufferArrayData(buffer, arr, size){
    bufferArrayDataGeneral(buffer, new Float32Array(arr), size);
}
function bufferArrayDataGeneral(buffer, arr, size){
   //console.log("size:" + size);
   gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
   gl.bufferData(gl.ARRAY_BUFFER, arr, gl.STATIC_DRAW);
   buffer.itemSize = size;
   buffer.numItems = arr.length / size;
}


function drawStuff(){
    requestAnimationFrame(drawStuff);
/*
    var activeShaderProgram = shaderPrograms.flatcolor;
    gl.useProgram(activeShaderProgram);
    gl.uniform4f(activeShaderProgram.uniforms.uColor, 1,0,0,1); //red
    drawObjectFromBuffers(fsBuffers, activeShaderProgram);
*/
    var activeShaderProgram = shaderPrograms.tex;
    gl.useProgram(activeShaderProgram);
    //bind2dTextureIfRequired(lenaGrayTex);
    bind2dTextureIfRequired(compressedTex);
	gl.uniform1i(activeShaderProgram.uniforms.uSampler, 0);
    drawObjectFromBuffers(fsBuffers, activeShaderProgram);
}


function drawObjectFromBuffers(bufferObj, shaderProg, usesCubeMap, drawMethod){
	prepBuffersForDrawing(bufferObj, shaderProg, usesCubeMap);
	drawObjectFromPreppedBuffers(bufferObj, shaderProg, drawMethod);
}

function prepBuffersForDrawing(bufferObj, shaderProg, usesCubeMap){
	enableDisableAttributes(shaderProg);
	
	gl.bindBuffer(gl.ARRAY_BUFFER, bufferObj.vertexPositionBuffer);
    gl.vertexAttribPointer(shaderProg.attributes.aVertexPosition, bufferObj.vertexPositionBuffer.itemSize, gl.FLOAT, false, 0, 0);
	
	if (shaderProg.uniforms.uSampler){
		gl.uniform1i(shaderProg.uniforms.uSampler, 0);
	}
	
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, bufferObj.vertexIndexBuffer);
}

function drawObjectFromPreppedBuffers(bufferObj, shaderProg, drawMethod){
	if (shaderProg.uniforms.uMVMatrix){
		gl.uniformMatrix4fv(shaderProg.uniforms.uMVMatrix, false, mvMatrix);
	}
	drawMethod = drawMethod || gl.TRIANGLES;
	gl.drawElements(drawMethod, bufferObj.vertexIndexBuffer.numItems, gl.UNSIGNED_SHORT, 0);
}


var enableDisableAttributes = (function generateEnableDisableAttributesFunc(){
	var numEnabled = 0;
	
	return function(shaderProg){
		
		var numToBeEnabled = shaderProg.numActiveAttribs;
		if (numToBeEnabled>numEnabled){
			for (var ii=numEnabled;ii<numToBeEnabled;ii++){
				gl.enableVertexAttribArray(ii);
			}
		}
		if (numToBeEnabled<numEnabled){
			for (var ii=numToBeEnabled;ii<numEnabled;ii++){
				gl.disableVertexAttribArray(ii);
			}
		}
		numEnabled = numToBeEnabled;
	};
})();

var lenaGrayTex;
var compressedTex;
function initTexture(){
    lenaGrayTex = makeTexture("png-src/lena512gray.png");
    compressedTex = makePlaceholderTexture();
}

function makePlaceholderTexture(){
	//dummy 1 pixel image to avoid error logs. https://stackoverflow.com/questions/21954036/dartweb-gl-render-warning-texture-bound-to-texture-unit-0-is-not-renderable
	var texture = gl.createTexture();
	bind2dTextureIfRequired(texture);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
		new Uint8Array([255, 0, 255, 255])); // magenta. should be obvious when tex not loaded.
	return texture;
}

function loadImage(src, callback){
    var image = new Image();
    image.onload=callback;
    image.src = src;
}

function makeTexture(src, yFlip = true) {	//to do OO
	var texture = makePlaceholderTexture();
    
    loadImage(src, function(loadInfo){
        var image = loadInfo.srcElement;
		bind2dTextureIfRequired(texture);
		gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, yFlip);

		gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);	//linear colorspace grad light texture (TODO handle other texture differently?)
		
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
		
        bind2dTextureIfRequired(null);	//AFAIK this is just good practice to unwanted side effect bugs
        
        setupCompressedTextureFromImage(image);
	});
	return texture;
}

function setupCompressedTextureFromImage(img){
    var canvas = document.createElement('canvas');
    canvas.width=img.width;
    canvas.height=img.height;
    var context = canvas.getContext('2d');
    context.drawImage(img, 0, 0);
    var imgData = context.getImageData(0, 0, canvas.width, canvas.height).data;
    setupCompressedTextureFromImagedata(imgData);
}

var u8data;
var u32data;
function setupCompressedTextureFromImagedata(imagedata){
    //initial implementation - not compressed, just check can use typed array to copy data.

    u8data = imagedata;
    u32data = new Uint32Array(imagedata.buffer);

    console.log(imagedata);
    console.log(u32data);   //see that u32data[0] = u8data[0] + 256*u8data[1] + 256*256*u8data[2] + 256*256*256*u8data[3]
                        //and can use this to modify or read whole pixel (4 channels) in 1 go

    //set red dot something so can tell that loaded.
    for (var xx=0;xx<100;xx++){
        u32data[xx] = 0xFF0000FF;   //red
    }

    /*
    var imgSize = 512*512;
    var imgBlocks = imgSize/16;
    var compressedImageData = new Int16Array();
    */
    
    bind2dTextureIfRequired(compressedTex);
        //gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, yFlip);
        gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);	
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 512, 512, 0, gl.RGBA, gl.UNSIGNED_BYTE, u8data);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    bind2dTextureIfRequired(null);
    
}

var bind2dTextureIfRequired = (function createBind2dTextureIfRequiredFunction(){
	var currentlyBoundTextures=[];
	var currentBoundTex;
	return function(texToBind, texId = gl.TEXTURE0){	
		currentBoundTex = currentlyBoundTextures[texId];
        gl.activeTexture(texId);  
        if (texToBind != currentBoundTex){
			//gl.activeTexture(texId);
			gl.bindTexture(gl.TEXTURE_2D, texToBind);
			currentlyBoundTextures[texId] = texToBind;
		}
	}
})();