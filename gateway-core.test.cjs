const test=require('node:test');
const assert=require('node:assert/strict');
const {project,isLand,rotate}=require('./gateway-core.js');
test('USA turns to the visible front at final longitude',()=>{assert.ok(project(-100,38,-100).z>.9);assert.ok(Math.abs(project(-100,38,-100).x)<1e-10);assert.ok(project(-100,38,90).z<0);});
test('rotation is continuous, bounded and finishes at USA',()=>{assert.equal(rotate(0),90);assert.equal(rotate(1),-100);assert.equal(rotate(-1),90);assert.equal(rotate(2),-100);let previous=90;for(let step=0;step<=100;step++){const value=rotate(step/100);assert.ok(value<=previous);previous=value;}});
test('land dots include mainland USA, China, Brazil and Australia, exclude Pacific',()=>{for(const [lon,lat]of [[-100,38],[105,35],[-53,-12],[134,-25]])assert.equal(isLand(lon,lat),true);assert.equal(isLand(-150,0),false);});
test('orthographic projection remains on unit sphere',()=>{for(let lon=-180;lon<=180;lon+=30){const point=project(lon,42,90);assert.ok(Math.abs(point.x**2+point.y**2+point.z**2-1)<1e-10);}});
