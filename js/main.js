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
    //initTexture();
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
    var activeShaderProgram = shaderPrograms.flatcolor;
    gl.useProgram(activeShaderProgram);
    gl.uniform4f(activeShaderProgram.uniforms.uColor, 1,0,0,1); //red
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