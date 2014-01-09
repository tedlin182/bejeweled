/*
		Bejeweled Game

		1. After click first tile, need to keep note
		2. After click second tile, need to swap positions with first tile.
		3. After swap, need detect if have 3+ in a row in any direction (excluding diagonal)
				- Yes:
						1. Remove tiles
						2. Move tiles above ones that were removed to newly removed tiles spot
						3. Drop more tiles to fill the grid (randomly choose which gems to drop)
						4. Check again to see if you have 3+ in a row again
						5. For every sequence of 3+ you clear, it's xx points. Scoreboard should be subscribed to an event to auto-update. 

		All scenarios to check for:
			- As select 2nd tile, make sure it's 1) adjacent to 1st selected tile 2) If adjacent, then check if will create 3+ in a row
			- As new tiles fall, see if any 3+ in a row are created and clear those
*/

(function (global, $) {
/*
	 On page load:
	 	1. Game prep - adding "tile-[index]" class to each title
		2. Bind click events to tiles
		3. Subscribe scoreboard to updateScore event
*/

/*
		Need algorigthm to calculate which tile to swap with (eg. 2n + 8) based on if it's to the top, bottom, left, or right of the first selected tile
*/
	// var Bejeweled = function (options) {
	// };

	// Bejeweled.prototype = {


	// };

	var Bejeweled = global.Bejeweled || (function () {
		return {
				el: document.getElementById("game"),
				init: function (options) {
					this._construct.call(this, options);

					this._prep()._activate();
				},
				_construct: function (options) {
					this.gameboard = options.gameboard || null;
					this.tileWidth = options.tileWidth || 50;
					this.tileColors = options.tileColors || ["blue", "green", "yellow", "red", "grey", "orange", "magenta"];
					// Set tiles in each row to help when calculating/finding
					// tiles selected
					this.tilesPerRow = options.tilesPerRow || 8;

					return this;
				},
				_prep: function () {
					// Set jQuery wrapped 'el'
					this.$el = $(this.el);

					// Storage container to remember tile order; Better than having to search DOM and detect what the surrounding tiles are
					this.tileOrder = {};

					// Set tileSelected flag
					this.tileSelected = false;

					// Create new gameboard
					this._createBoard();

					return this;
				},
				_activate: function () {
					var self = this;

					// Bind click handler to tiles
					self.$el.on("click", ".tile", function (e) {
						e.preventDefault();

						self.selectTile(this);
					});

					// On "swap", trigget removeTiles handler
					self.gameboard.on("swap", function (evt, data) {
						// Trigger removeTiles handler
						self._scanner(data);
					});

					return this;
				},
				_isMultipleOf: function (num, multipleNum) {
					return (num % multipleNum) === 0;
				},
				// Randomly pick color
				_randomColorPicker: function () {
					var randomizer = Math.floor((Math.random() * (this.tileColors.length - 1)) + 1);

					return this.tileColors[randomizer];
				},
				_createBoard: function () {
					var numOfTiles = Math.pow(this.tilesPerRow, 2),
							len = numOfTiles - 1,
							i = 0,
							tile = "",
							self = this,
							row,
							col,
							tilePos,
							tileColor;

					// By default for tile numbers less than the number 8 (number of tiles in first row),
					// the row position will be 1 and the column position will be the tile number itself
					var tileRow = function (tileNum) {
						var rowPos = 1;

						// Once we get to tiles above the tiles per row, then we need to do calculations
						if (tileNum > self.tilesPerRow) {
								// To get row position, see how many times the tilesPerRow go into
								// tileNum
								rowPos = Math.floor(tileNum / self.tilesPerRow);

								// If the tileNum is not a multiple of the tilesPerRow, round up 1
								if (!self._isMultipleOf(tileNum, self.tilesPerRow)) {
									rowPos += 1;
								}
						}

						// Return row position
						return rowPos;
					};

					// For tileNum > 8
					// By default for tile numbers less than the number 8 (number of tiles in first row),
					// the row position will be 1 and the column position will be the tile number itself
					var tileCol = function (tileNum) {
						var colPos = tileNum;

						// Once we get to tiles above the tiles per row, then we need to do calculations
						if (tileNum > self.tilesPerRow) {
								colPos = tileNum % self.tilesPerRow;
						}

						// Return column position
						return self._isMultipleOf(tileNum, self.tilesPerRow) ? 8 : colPos;
					};

					for (; i <= len; i++) {
						tilePos = i + 1;
						tileColor = self._randomColorPicker();
						row = tileRow(tilePos);
						col = tileCol(tilePos);

						// As first build tileboard, store tile color, row, and column into object for easy reference
						self.tileOrder[tilePos] = [tileColor, row, col];

						// Create tile, add class to establish coordinates on grid, and position tile accordingly
						tile += "<div id=\"tile_" + row + "_" + col + "\" class=\"tile col_" + col + " row_" + row + "\" style=\"background-color: " + tileColor + "; width: " + self.tileWidth + "px; height: " + self.tileWidth + "px; left: " + (col * self.tileWidth) + "px; top: " + (row * self.tileWidth) + "px; \" data-position=\"" + tilePos + "\"><\/div>";
					}

					// Append tiles to gameboard
					self.gameboard.append(tile);

					// See where there are streaks of 3+ gems
					self._scanner();

					return this;
				},
				_gatherRowsCols: function (data) {
					var tileInfo = this._fetchTileInfo(data.tile),
							otherTileInfo = this._fetchTileInfo(data.otherTile);

					return [[tileInfo[1], otherTileInfo[1]], [tileInfo[2], otherTileInfo[2]]];
				},
				_createNewGems: function () {

				},
				_moveGems: function () {

				},
				_removeGems: function () {
					var $tiles = this.gameboard.find(".remove");

					// If the number of gems marked for removal via "remove" class is 0,
					// then trigger swap back.
					if ($tiles.length < 1) {
						// this._swapTiles();
						// return this;
					}

					// Once loop through all tiles, then remove them
					$tiles.fadeOut(500, function () {
						$(this).remove();
					});

					// Fade them out, shift them off screen, update with new info (update remove tiles with new info in this.tileOrder) and then move them
				},
				_scanner: function (data) {
					var self = this,
							i = 1,
							len = self.tilesPerRow,
							rowsCols,
							rows,
							cols,
							$tilesForRemoval,
							tile,
							otherTile;

					// Go through each column and see if there are streaks of 3 or more
					// If so, just mark them for removal
					var scanRowColumn = function (rowCol) {
						var $rowCol = $(rowCol),
								$tile,
								tileInfo,
								tileMatch,
								streak = 1,
								j = 0,
								rowColLen = $rowCol.length - 1;

						// Grabs row/column and cycles through all tiles in it to see if there's
						// a streak.
						for (; j <= rowColLen; j++) {
							$tile = $($rowCol[j]);
							tileInfo = self._fetchTileInfo($tile[0]);

							// Set tileMatch to first tile in column/row color;
							if (j === 0) {
								tileMatch = tileInfo[0];
							}

							// console.log("=-=-=-=-=-=-=-=-=-=-=-=-==-");
							// console.log("tile match: " + tileMatch);
							// console.log("tileInfo[0]: " + tileInfo[0]);

							// Start marking "gem_match" from the beginning tile.
							// If the tile matches the tile to match, then mark it is a "match"
							if (tileMatch === tileInfo[0]) {
								// Mark every tile as a "match"
								$tile.addClass("gem_match");

								// console.log($tile[0].className);
								// Always increment streak count by 1 as you find matches
								if (j > 0) {
									streak++;
								}

								// Need to check if streak is 3 or more.
								// Once streak is 3, find "gem_match" tiles and mark to remove with
								// "remove" class
								if (streak === 3) {
									$(rowCol + ".gem_match").addClass("remove");
								}

								// If the streak goes beyond 3, then mark the current tile for removal
								// with "remove" class
								if (streak > 3) {
									$tile.addClass("remove");
								}
							} else {
								// If tile does not match previous tile:
								
								// 1. Reset tile to match
								tileMatch = tileInfo[0];

								// 2. Reset streak counter
								streak = 1;

								// 3. Remove "gem_match" from tiles that aren't marked for removal via
								// "remove" class
								// ISSUE: On first tile of new streak, "gem_match" gets set and since it
								// won't match previous tile, "gem_match" gets wiped out.
								// Remove "gem_match" from all tiles not marked for removal via "remove" class
								// and then start new streak by marking current new tile with "gem_match"
								$(rowCol + ".gem_match").not(".remove").removeClass("gem_match");

								$tile.addClass("gem_match");
							}
						}

						// console.log(self.gameboard.find(".remove"));

						// Once done scanning row/column, if at the end and streak isn't 3+, clear "gem_match" tiles not marked for removal
						if (streak < 3) {
							$(rowCol + ".gem_match").not(".remove").removeClass("gem_match");
						}

						// Remove gems
						self._removeGems();

						return self;
					};

					// If no row or col is specified, then scan all
					if (data) {
						rowsCols = self._gatherRowsCols(data);
						rows = rowsCols[0];
						cols = rowsCols[1];
						len = rows.length;

						console.log(rows);
						console.log(cols);
						for (; i <= len; i++) {
							scanRowColumn(".row_" + rows[i]);
							scanRowColumn(".col_" + cols[i]);
						}
					} else {		
						for (; i <= len; i++) {
							scanRowColumn(".row_" + i);
							scanRowColumn(".col_" + i);
						}
					}

					$tilesForRemoval = this.gameboard.find(".remove");


					return this;
				},
				_fetchTileInfo: function (tile) {
					return this.tileOrder[tile.getAttribute("data-position")];
				},
				// When selecting a 2nd tile to swap with, check to see if it's adjacent to the first selected tile. If it is, return that tile.
				// If not, then do nothing
				_isAdjacentTile: function (firstSelTile, secondSelectedTile) {
					var firstTilePos = firstSelTile.getAttribute("data-position"),
							secondTilePos = secondSelectedTile.getAttribute("data-position"),
							tilePosGap = Math.abs(secondTilePos - firstTilePos),
							isAdjacent = null;
							
					// If the gap is equal to 1, then it's left or right
					// If the gap is equal to the # of tiles per row, it's on the top/bottom
					if ((tilePosGap === 1) || (tilePosGap === this.tilesPerRow)) {
						isAdjacent = secondSelectedTile;
					}

					return isAdjacent;
				},
				// This should only happen on successful swap (and then also removal)
				_updateSwappedTilesInfo: function (tile, otherTile) {
					var tileInfo = this._fetchTileInfo(tile),
							otherTileInfo = this._fetchTileInfo(otherTile),
							tilePos = this.tileOrder[tile.getAttribute("data-position")],
							otherTilePos = this.tileOrder[otherTile.getAttribute("data-position")],
							tileClass = tile.className,
							otherTileClass = otherTile.className;

					// Update tile classes
					tile.className = otherTileClass;
					otherTile.className = tileClass;

					// Update tile data-position
					this.tileOrder[tile.getAttribute("data-position")] = otherTilePos;
					this.tileOrder[otherTile.getAttribute("data-position")] = tilePos;

					// Update tileOrder object after tiles have swapped
					this.tileOrder[tilePos] = otherTileInfo;
					this.tileOrder[otherTilePos] = tileInfo;

					return this;
				},
				_swapTiles: function (tile, otherTile) {
					var tilePosX = tile.style.left,
							tilePosY = tile.style.top,
							otherTilePosX = otherTile.style.left,
							otherTilePosY = otherTile.style.top;

					// Animate swap of tile positions
					$(tile).animate({
						top: otherTilePosY,
						left: otherTilePosX
					}, 500);

					$(otherTile).animate({
						top: tilePosY,
						left: tilePosX
					}, 500);

					this._updateSwappedTilesInfo(tile, otherTile);
					
					// Trigger "swap" event.
					this.gameboard.trigger("swap", { tile: tile, otherTile: otherTile });

					// Remove selected state
					this.gameboard.find(".selected").removeClass("selected");

					// Reset selected state
					this.tileSelected = false;

					return this;
				},
				selectTile: function (tile) {
					var firstTile;

					// Check to see one has already been selected via a true/false flag
					if (this.tileSelected) {
						firstTile = this.el.querySelector(".selected"),
						adjacentTile = this._isAdjacentTile(firstTile, tile);

						// FIRST => Second tile selected HAS to be on top/bottom/left/right of first in order to swap
						if (!adjacentTile) {
							return false;
						}

						// this._checkRowTiles(firstTile, adjacentTile);
						// this._scanBoardForStreaks();

						// Since a tile is already selected, 
						this._swapTiles(firstTile, adjacentTile);
					} else {
						// MAYBE?
						// If first selected, could find all adjacent tiles and add a class/attribute
						// to mark it as adjacent. If not, then return false;

						// Add selected state to tile
						$(tile).addClass("selected");

						// Change tileSelected state to true
						this.tileSelected = true;
					}

					return this;
				},
				swapTiles: function (firstTile, secondSelectedTile) {
					var $firstGem = $(firstTile),
							$secondGem = $(secondSelectedTile),
							firstGemType = firstTile.getAttribute("data-gemtype"),
							secondGemType = secondSelectedTile.getAttribute("data-gemtype");

					// Need to check if swap will result in 3+ in a row. If not, then do nothing
					// This can be done via _threeInARowCheck
					this._threeInARowCheck(firstTile, secondSelectedTile);

					// Swap gem types
					firstTile.setAttribute("data-gemtype", secondGemType);
					secondSelectedTile.setAttribute("data-gemtype", firstGemType);
					
					// Swap gem classes
					$firstGem.removeClass(firstGemType + " selected").addClass(secondGemType);
					$secondGem.removeClass(secondGemType).addClass(firstGemType);

					// Swap positions

					// Need to finally check if 3+ in a row
					// If not, switch the tiles back

					// Reset tileSelected state
					this.tileSelected = false;
					return this;
				}
		};
	}());


	Bejeweled.init({
		gameboard: $(".gameboard")
	});


	// $.fn.extend({
	// 	bejeweled: function (opts) {
	// 		var defaults = {
	// 			container: null,
	// 			numberTilesAcross: 8,
	// 			numberTilesDown: 8
	// 		}
	// 	}
	// });

	// Set Bejewled namespace to global object
	global.Bejeweled = Bejeweled;
}(this, jQuery));