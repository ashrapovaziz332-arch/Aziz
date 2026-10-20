-- Italian cypress (Sarv) importer for 3ds Max
-- Run: Scripting > Run Script... > import_cypress.ms
-- Imports cypress.obj, stands it upright, scales it to real size (1:1)
-- in the current System Units and sets up two-sided cut-out materials.
(
	local treeHeight = "10m"   -- real height of the tree
	local dir = getFilenamePath (getThisScriptFilename())
	local texDir = dir + "textures\\"

	fn bitmapMap f = (Bitmaptexture filename:(texDir + f))

	fn importTree objFile groupName =
	(
		local before = objects as array
		importFile (dir + objFile) #noPrompt using:ObjImp
		local newObjs = for o in objects where findItem before o == 0 collect o
		if newObjs.count == 0 then (messageBox ("Import failed: " + objFile); return undefined)
		local g = group newObjs name:groupName
		-- if the importer did not flip Y-up to Z-up, stand the tree up
		local sz = g.max - g.min
		if sz.y > sz.z then rotate g (angleaxis 90 [1,0,0])
		-- scale to real height in current system units
		sz = g.max - g.min
		local k = (units.decodeValue treeHeight) / sz.z
		g.pivot = [g.center.x, g.center.y, g.min.z]
		scale g [k, k, k]
		g.pos = [0, 0, 0]
		g
	)

	local bark = StandardMaterial name:"Cypress_Bark" diffuseMap:(bitmapMap "cypress_bark.jpg")
	local core = StandardMaterial name:"Cypress_FoliageCore" diffuseMap:(bitmapMap "cypress_foliage_core.jpg")
	local cards = StandardMaterial name:"Cypress_FoliageCards" twoSided:true \
		diffuseMap:(bitmapMap "cypress_foliage_atlas_diffuse.jpg") \
		opacityMap:(bitmapMap "cypress_foliage_atlas_opacity.png")
	local bill = StandardMaterial name:"Cypress_Billboard" twoSided:true \
		diffuseMap:(bitmapMap "cypress_billboard.png") \
		opacityMap:(bitmapMap "cypress_billboard_opacity.png")
	for m in #(bark, core, cards, bill) do showTextureMap m true

	local tree = importTree "cypress.obj" "Cypress_10m"
	if tree != undefined then
	(
		for o in tree.children do
		(
			case of
			(
				(matchPattern o.name pattern:"*Trunk*"): o.material = bark
				(matchPattern o.name pattern:"*Core*"): o.material = core
				(matchPattern o.name pattern:"*Cards*"): o.material = cards
			)
		)
	)

	if queryBox "Billboard (yengil, 6 poligon) variantini ham import qilaymi?" then
	(
		local bb = importTree "cypress_billboard.obj" "Cypress_Billboard_10m"
		if bb != undefined then
		(
			for o in bb.children do o.material = bill
			bb.pos = [units.decodeValue "3m", 0, 0]
		)
	)
	select tree
	max zoomext sel
	format "Cypress imported: height % (1:1)\n" treeHeight
)
