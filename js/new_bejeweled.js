(function (global, $, undefined) {
	var horizAndVertStreaksOnLoad = [
		"blue", "green", "yellow", "red", "grey",
		"orange", "magenta", "magenta", "magenta", "red",
		"blue", "yellow", "red", "red", "yellow",
		"blue", "red", "yellow", "red", "yellow",
		"blue", "grey", "grey", "yellow", "grey"
	];

	var noMovesOverlay = "<div class=\"overlay\"><p>No moves left.</p><\/div>";

	var Bejeweled = function (targ, opts) {
		this._construct.call(this, targ , opts || {});
	};

	/*
		Swapping gems left/right works with vertical streak when second selected tile creates
		the streak.
		Swapping gems top/bottom works with horizontal streak;
		Swapping gems top/bottom does NOT work with horizontal streak when second selected tile is
		the gem that creates a streak

	*/

	Bejeweled.prototype = {
		_construct: function (targ, opts) {
			var self = this;

			// Defined new properties
			this.$targ = $(targ) || null;
			this.targ = this.$targ[0] || null;

			// Gameboard will always be a square, so # of rows = #of cols;
			this.gemsPerRow = opts.gemsPerRow || 5;
			this.gemDimensions = opts.gemDimensions || 100;
			this.gemColors = opts.tileColors || ["blue", "green", "yellow", "red", "grey", "orange", "magenta"];	
			this.scoreboard = opts.scoreboard || null;

			// Create new scoreboard
			this.bejeweledScoreboard = new Scoreboard(this.scoreboard, {
				playerScore: this.scoreboard.find(".score")
			});

			// Gemset to store gem order and gem info
			this.gemset = {};

			// Set gemSelected flag
			this.gemSelected = false;

			// Set container for removed gems
			this.removedGems = {};

			// Keep track to see if gem streaks exist
			this.streaksExist = false;

			// Track if done creating new gems
			this.creatingGems = false;

			// See if valid moves exist
			this.validMovesExist = false;

			// Invoke _prep and _activate
			this._activate();

			// Create gameboard
			this.createGameboard();

			return this;
		},
		// Here we bind event handlers
		_activate: function () {
			var self = this;

			self.$targ.on({
				// This removes the streaks of gems
				"removeGems": function (e, data){
					self.removeGems();
				},
				// Once gems are removed, this event shifts gems down into fill the gaps
				"moveGems": function (e, data) {
					self.moveGems(data.removedGems);
				},
				// Triggers scan for streaks
				"scanRowsCols": function (e, data) {
					// After new gems are created and added,
					if (data) {
						self.scanRowsCols(data.gems);
					} else {
						self.scanRowsCols();
					}
				},
				// Adds gem to gameboard
				"addGems": function (e, data) {
					// Add gems to board
					self.$targ.prepend(data.gems);

					if (!self.creatingGems) {
						self.$targ.trigger("scanRowsCols");

						if (data.callback) {
							data.callback();
						}
					}
				},
				"createNewGem": function (e, data) {
						var gems = data.gems,
								callback = data.callback,
								i = 0,
								len = gems.length - 1,
								newGems = "";

						for (; i <= len; i++) {
							newGems += self.createNewGems(gems[i]);
						}

						if (callback) {
							callback(newGems);
						}
				},
				// Gem swap
				"swap": function (e, data) {
					var gems = data.gems;
					// We provide a callback to do swapped gem updates (attributes and
					// gemset) as we want to wait until gems have swapped to then
					// update the gem attributes and gemset order.
					// After that is done, THEN we scan the rows and columns to see
					// if streaks exist.
					// If streaks exist, THEN we trigger removeGems
					self.swapGems(gems[0], gems[1], function (gem, otherGem) {
						// Update the swapped gems so when we scan for gem streaks, we have the correct info
						self._updateSwappedTilesInfo(gem, otherGem);

						// After gem info has been updated along with the gemset object,
						// scan rows and columns for streaks. Remember to scan the row and
						// column for BOTH gems that were swapped
						self.$targ.trigger("scanRowsCols", { gems: [gem.getAttribute("data-position"), otherGem.getAttribute("data-position")]});

						// If a streak is found, then remove the gems
						if (!self.streaksExist) {
							// Otherwise swap gems back with NO callback
							self.swapGems(gem, otherGem);
						}
					});
				}
			});

			// Bind click handlers to tiles
			self.$targ.on("click", ".tile", function (e) {
				// Allow this when gems are not being moved, created, or added
				if (!self.creatingGems) {
					self.selectTile(this);
				}
			});

			return self;
		},
		_checkSurroundingColumnGems: function (data) {
			var pos = data.gemPos,
					colorMatch = data.colorMatch,
					currentGem = data.currentGem,
					gem = this.gemset[pos],
					gemRow = gem[1],
					gemCol = gem[2],
					leftGemPos = pos - 1,
					gemAbovePos = pos - this.gemsPerRow,
					gemBelowPos = pos + this.gemsPerRow,
					rightGemPos = pos + 1,
					surroundingGems = [],
					i = 0,
					len,
					// TODO: Testing
					gemToScan;

			// This is the non-matching gem that you will check to see if
			// surrounding gems will make a streak

			// This should all that be checked if gem being checked is a gap
			// between 2 of the same color gems

			// If not at last column, then check gem to right
			if (gemCol !== this.gemsPerRow) {
				surroundingGems.push(rightGemPos);
			}

			// If not at first column, then check gem to left
			if (gemCol !== 1) {
				surroundingGems.push(leftGemPos);
			}

			// If a gap doesn't exist, then check top/bottom depending
			// on if start or end
			if (!data.gapExists) {
				// Detect if gem to be scanned is above or below streak
				// Based on if isStart and isEnd, can do the following:
				//	1. With currentGem being provided (which is the 2nd gem in streak)
				//	2. If streak is not at start, you need to scan gem above streak
				//	3. If streak is not at end, you need to scan gem below streak

//				if (!data.isStart) {
//					// Current gem is 2nd gem in streak, so to grab gem above
//					// streak, go 2 gems up
//					gemToScan = currentGem - (2 * this.gemsPerRow);
//
//					// As long as gem is not in first row, scan gem above gemToScan
//					if (gemToScan > this.gemsPerRow) {
//						surroundingGems.push(gemToScan)
//					}
//				}
//
//				if (!data.isEnd) {
//					gemToScan = currentGem + this.gemsPerRow;
//
//					// As long as gem is not in first row, scan gem above gemToScan
//					if (gemToScan > this.gemsPerRow) {
//						surroundingGems.push(gemToScan)
//					}
//				}
//
//				// If gem to be scanned is above current gem, then this is top-most
//				// gem in streak.
//				// Since this is already passed in
//				if (pos < currentGem) {
//					// If gem to be scanned is at row > 1, then we know:
//					//	1.
//					if (gemRow > 1) {
//						console.log("--- The streak is not start of the column and gem is not the first in the column, so scan gem above");
//						surroundingGems.push(gemAbovePos);
//					}
//				}


				// IF:
				//	1. Streak not at start of column
				//	2. Gem being scanned isn't the first in the column
				//	3. Gem above is not the current gem

				// If streak is not at start of column, look at gem before
				// gem being scanned AND the gem to the left of gem being
				// scanned ISN'T the current gem being eval'd in
				// _checkForValidHorizMoves();
				if (!data.isStart && (gemAbovePos !== currentGem) && (gemRow !== 1)) {
					surroundingGems.push(gemAbovePos);
				}

				// IF:
				//	1. Streak not at end of column
				//	2. Gem being scanned isn't the last in the column
				//	3. Gem above is not the current gem

				// If streak is not at end of row AND gem to the right isn't the
				// first gem of the streak AND this gem isn't the end of the row,
				// look at gem after gem being scanned
				if (!data.isEnd && (gemBelowPos !== (currentGem - this.gemsPerRow)) && (gemRow !== this.gemsPerRow)) {
					surroundingGems.push(gemBelowPos);
				}
			}

			// Define length of array here after all gems have been added
			// to surroundingGems
			len = surroundingGems.length - 1;

			// Check gems
			for (; i <= len; i++) {
				// If one of the surrounding gems matches the color to match,
				// then valid moves exist and can break out of loop
				if (this.gemset[surroundingGems[i]][0] === colorMatch) {
					this.validMovesExist = true;
					return true;
				}
			}

			return false;
		},
		_checkSurroundingRowGems: function (data) {
			var pos = data.gemPos,
					colorMatch = data.colorMatch,
					currentGem = data.currentGem,
					gem = this.gemset[pos],
					gemRow = gem[1],
					gemCol = gem[2],
					leftGemPos = pos - 1,
					gemAbovePos = pos - this.gemsPerRow,
					gemBelowPos = pos + this.gemsPerRow,
					rightGemPos = pos + 1,
					surroundingGems = [],
					i = 0,
					len;

			// This is the non-matching gem that you will check to see if
			// surrounding gems will make a streak

			// This should all that be checked if gem being checked is a gap
			// between 2 of the same color gems

			// If not on bottom row, then check below gem
			if (gemRow !== this.gemsPerRow) {
				surroundingGems.push(gemBelowPos);
			}

			// If not on top row, check above gem
			if (gemRow !== 1) {
				surroundingGems.push(gemAbovePos);
			}

			// If a gap doesn't exist, then check left/right depending
			// on if start or end
			if (!data.gapExists) {
				// If streak is not at start of row, look at gem before
				// gem being scanned AND the gem to the left of gem being
				// scanned ISN'T the current gem being eval'd in
				// _checkForValidHorizMoves();
				if (!data.isStart && (leftGemPos !== currentGem) && (gemCol !== 1)) {
					surroundingGems.push(leftGemPos);
				}

				// If streak is not at end of row AND gem to the right isn't the
				// first gem of the streak AND this gem isn't the end of the row,
				// look at gem after gem being scanned
				if (!data.isEnd && (rightGemPos !== (currentGem - 1)) && (gemCol !== this.gemsPerRow)) {
					surroundingGems.push(rightGemPos);
				}
			}

			// Define length of array here after all gems have been added
			// to surroundingGems
			len = surroundingGems.length - 1;

			// Check gems
			for (; i <= len; i++) {
				// If one of the surrounding gems matches the color to match,
				// then valid moves exist and can break out of loop
				if (this.gemset[surroundingGems[i]][0] === colorMatch) {
					// TODO: Test code
					$("#tile_gemPos_" + surroundingGems[i]).text("MATCH for " + pos);

					this.validMovesExist = true;
					return true;
				}
			}

			return false;
		},
		// Once find just one possible streak, then break out of loop
		_checkForValidHorizMoves: function (row) {
			var self = this,
					gapExists = false,
					gemSet = this.gemset,
					gem,
					gemCol,
					totalGems = Math.pow(this.gemsPerRow, 2),
					gemPos = 1,
					colorMatch,
					gemColor2back,
					currentColor;

			// Cycle through all gems
			while (gemPos <= totalGems) {
				// Grab gem in gemset
				gem = gemSet[gemPos];
				currentColor = gem[0];
				gemCol = gem[2];

				// If current gem matches (this will be for streak of 2 in a row)
				if (currentColor === colorMatch) {
					// 2 in a row so no gap
					gapExists = false;

					// Here we are at the start of the row
					if (gemCol === 2) {
						self._checkSurroundingRowGems({
							// TODO: Test code
							currentGem: gemPos,
							gemPos: gemPos + 1,
							gapExists: gapExists,
							colorMatch: colorMatch,
							isStart: true,
							isEnd: false
						});

					} else if (gemCol === self.gemsPerRow) {
						// Here we are at the end of the row
						self._checkSurroundingRowGems({
							// TODO: Test code
							currentGem: gemPos,
							gemPos: gemPos - 2,
							gapExists: gapExists,
							colorMatch: colorMatch,
							isStart: false,
							isEnd: true
						});
					} else {
						self._checkSurroundingRowGems({
							// TODO: Test code
							currentGem: gemPos,
							gemPos: gemPos + 1,
							gapExists: gapExists,
							colorMatch: colorMatch,
							isStart: false,
							isEnd: false
						});

						self._checkSurroundingRowGems({
							// TODO: Test code
							currentGem: gemPos,
							gemPos: gemPos - 2,
							gapExists: gapExists,
							colorMatch: colorMatch,
							isStart: false,
							isEnd: false
						});
					}

					// If valid moves exist
					if (self.validMovesExist) {
						return this;
					} else {
						// If no valid moves exist, start over
						colorMatch = currentColor;

						gapExists = false;
					}
				} else {
					// If a gap already exists and color still not matching,
					if (gapExists) {
						// Check to see if current gem color matches the color
						// of the gem 2 back
						if (currentColor === gemColor2back) {
							self._checkSurroundingRowGems({
								// TODO: Test code
								currentGem: gemPos,
								gemPos: gemPos - 1,
								gapExists: gapExists,
								colorMatch: gemColor2back
							});

							// Then reset gapExists
							gapExists = false;

							// Reset gem2back and only redefine it when a new
							// gap is created
							gemColor2back = currentColor;
						} else {
							// If current gem color doesn't match, then update gemColor2back to gem color 1 back
							gemColor2back = self.gemset[gemPos - 1][0];
						}
					} else if (gemCol !== 1) {
						// If gap doesn't exist and current gem color doesn't match,
						// then this current gem is creating a gap
						gapExists = true;

						// Because we want to see if next gem color matches the color
						// of the gem previous to this one, we store it in memory
						gemColor2back = this.gemset[gemPos - 1][0];
					}

					// Whenever gem color doesn't match color to match,
					// we reset color to match to current gem's color
					colorMatch = currentColor;
				}

				// If at last gem in the row, clear out color to match
				if (gemCol === this.gemsPerRow) {
					colorMatch = null;

					// Reset gap exists flag when start on new row
					gapExists = false;
				}

				// Move to next gem
				gemPos++;
			}

			// If no valid moves exist, create a new gameboard
			if (!self.validMovesExist) {
				// If no horizontal streaks are possible, then scan vertically
				self._checkForValidVertMoves();
			}

			return this;
		},
		// Once find just one possible streak, then break out of loop
		_checkForValidVertMoves: function () {
			var self = this,
				gapExists = false,
				gemSet = this.gemset,
				gem,
				gemRow,
				gemCol,
				totalGems = Math.pow(this.gemsPerRow, 2),
				gemPos = 1,
				colorMatch,
				gemColor2back,
				currentColor;

			// Cycle through all gems
			while (gemPos <= totalGems) {
				// Grab gem in gemset
				gem = gemSet[gemPos];
				currentColor = gem[0];
				gemRow = gem[1];
				gemCol = gem[2];

				// If current gem matches (this will be for streak of 2 in a row)
				if (currentColor === colorMatch) {
					// 2 in a row so no gap
					gapExists = false;

					// Here we are at the start of the row
					if (gemRow === 2) {
						self._checkSurroundingColumnGems({
							// TODO: Test code
							currentGem: gemPos,
							gemPos: gemPos + self.gemsPerRow,
							gapExists: gapExists,
							colorMatch: colorMatch,
							isStart: true,
							isEnd: false
						});

					} else if (gemRow === self.gemsPerRow) {
						// Here we are at the end of the row
						self._checkSurroundingColumnGems({
							// TODO: Test code
							currentGem: gemPos,
							gemPos: gemPos - (2 * self.gemsPerRow),
							gapExists: gapExists,
							colorMatch: colorMatch,
							isStart: false,
							isEnd: true
						});
					} else {
						self._checkSurroundingColumnGems({
							// TODO: Test code
							currentGem: gemPos,
							gemPos: gemPos + self.gemsPerRow,
							gapExists: gapExists,
							colorMatch: colorMatch,
							isStart: false,
							isEnd: false
						});

						self._checkSurroundingColumnGems({
							// TODO: Test code
							currentGem: gemPos,
							gemPos: gemPos - (2 * self.gemsPerRow),
							gapExists: gapExists,
							colorMatch: colorMatch,
							isStart: false,
							isEnd: false
						});
					}

					// If valid moves exist
					if (self.validMovesExist) {
						return this;
					} else {
						// If no valid moves exist, start over
						colorMatch = currentColor;

						gapExists = false;
					}
				} else {
					// If a gap already exists and color still not matching,
					if (gapExists) {
						// Check to see if current gem color matches the color
						// of the gem 2 back
						if (currentColor === gemColor2back) {
							self._checkSurroundingColumnGems({
								// TODO: Test code
								currentGem: gemPos,
								gemPos: gemPos - self.gemsPerRow,
								gapExists: gapExists,
								colorMatch: gemColor2back,
								scanColumns: true
							});

							// Then reset gapExists
							if (self.streaksExist) {
								gapExists = false;
							}

							// Reset gem2back and only redefine it when a new
							// gap is created
							gemColor2back = currentColor;
						} else {
							// If current gem color doesn't match, then update gemColor2back to gem color 1 back
							gemColor2back = self.gemset[gemPos - self.gemsPerRow][0];
						}
					} else if (gemRow !== 1) {
						// If gap doesn't exist and current gem color doesn't match,
						// then this current gem is creating a gap
						gapExists = true;

						// Because we want to see if next gem color matches the color
						// of the gem previous to this one, we store it in memory
						gemColor2back = self.gemset[gemPos - self.gemsPerRow][0];
					}

					// Whenever gem color doesn't match color to match,
					// we reset color to match to current gem's color
					colorMatch = currentColor;
				}

				// Once hit last row, need to reset to next column until hit last
				// column
				if (gemRow === self.gemsPerRow) {
					colorMatch = null;

					// Reset gap exists flag when start on new row
					gapExists = false;

					// As long as not at last column, once hit last gem in column
					// next gem will be first gem in next column
					if (gemCol < self.gemsPerRow) {
						gemPos = gemCol + 1;
					}
				} else {
					// Move to next gem
					gemPos += self.gemsPerRow;
				}
			}

			// If no valid moves exist, create a new gameboard
			if (!self.validMovesExist) {
				self.$targ.append(noMovesOverlay);

				self.$targ.find(".overlay").fadeOut(3000, function () {
					// Remove overlay
					$(this).remove();

					// Empty gameboard
					self.targ.innerHTML = "";

					// Trigger create new gameboard
					self.createGameboard();
				});
			}

			return this;
		},
		_getGemPosition: function (row, col) {
				return (row * this.gemsPerRow) - (this.gemsPerRow - col);
		},
		// To easily grab gem info from gemset
		_fetchTileInfo: function (gem) {
			return this.gemset[gem.getAttribute("data-position")];
		},
		// Color randomizer
		_setGemColor: function () {
			var randomizer = Math.floor((Math.random() * (this.gemColors.length - 1)) + 1);

			return this.gemColors[randomizer];
		},
		_isAdjacentGem: function (gem, otherGem) {
			var firstGemPos = gem.getAttribute("data-position"),
					secondGemPos = otherGem.getAttribute("data-position"),
					gemPosGap = Math.abs(secondGemPos - firstGemPos),
					isAdjacent = null;

			// If the gap is equal to 1, then it's left or right
			// If the gap is equal to the # of tiles per row, it's on the top/bottom
			if ((gemPosGap === 1) || (gemPosGap === this.gemsPerRow)) {
				isAdjacent = otherGem;
			}

			return isAdjacent;
		},
		_updateGemset: function (gem, otherGem) {
			var gemInGemset = this.gemset[gem.getAttribute("data-position")],
					otherGemInGemset = this.gemset[otherGem.getAttribute("data-position")],
					gemColor = gemInGemset[0],
					otherGemColor = otherGemInGemset[0];

			// Swap colors
			gemInGemset[0] = otherGemColor;
			otherGemInGemset[0] = gemColor;

			return this;
		},
		// Used when gems are moved to new position after gem removal
		_updateGemInfo: function (gemToUpdate, newPos) {
			var gemPos = gemToUpdate.getAttribute("data-position"),
					gemInSet = this.gemset[gemPos],
					newRow = this.gemset[newPos][1];

			// Update color of gem in gemset
			this.gemset[newPos][0] = gemInSet[0];

			// Row => current row (this.gemset[gemPos][1]) + removedCount
			gemToUpdate.className = "tile row_" + newRow + " col_" + gemInSet[2];

			// New data-position
			gemToUpdate.setAttribute("data-position", newPos);

			// Update gem ID
			gemToUpdate.id = "tile_gemPos_" + newPos;

			return this;
		},
		// This should only happen on successful swap (and then also removal)
		_updateSwappedTilesInfo: function (gem, otherGem) {
			var gemPos = gem.getAttribute("data-position"),
					otherGemPos = otherGem.getAttribute("data-position"),
					gemClass = gem.className,
					otherGemClass = otherGem.className,
					gemId = gem.id,
					otherGemId = otherGem.id;

			// Update gemset
			this._updateGemset(gem, otherGem);

			// Update tile ID with gem position
			gem.id = otherGemId;
			otherGem.id = gemId;

			// Update tile classes
			gem.className = otherGemClass;
			otherGem.className = gemClass;

			// Update tile data-position
			gem.setAttribute("data-position", otherGemPos);
			otherGem.setAttribute("data-position", gemPos);

			return this;
		},
		createNewGems: function (data) {
			var row = data.row,
					col = data.col,
					gemPos = data.gemPos,
					gemXPos = (col - 1) * this.gemDimensions,
					gemYPos = (row - 1) * this.gemDimensions,
					gemRow = "row_" + row,
					gemCol = "col_" + col,
					gemColor = this._setGemColor(),
					gem;

			// As create gems, store gem info and gem order in an object for easy info access.
			// Much faster than scanning DOM
			this.gemset[gemPos] = [gemColor, row, col];

			// Need reference to gems removed and new gems take their spot
			// both in the DOM and in this.gemset
			gem = "<div id=\"tile_gemPos_" + gemPos + "\" class=\"tile " + gemRow + " " + gemCol + "\" style=\"background-color: " + gemColor + "; top: " + gemYPos+ "px; left: " + gemXPos + "px; width: " + this.gemDimensions + "px; height: " + this.gemDimensions + "px; \" data-position=\"" + gemPos + "\">" + gemPos + "<\/div>";

			// TODO: Should return gem with top === -gemHeight and new top position
			// so can animate down
			return gem;
		},
		createGameboard: function () {
			var self = this,
					col = 1,
					row = 1,
					gemPos = 1,
					gemsToCreate = [];

			// Start from col 1 and go to max # gems per row
			// Once reach end, reset and go to next row until reach
			// last row (ie. row === this.gemsPerRow)
			while (col <= self.gemsPerRow) {
				// Add new gem to collection
				gemsToCreate.push({
					row: row,
					col: col,
					gemPos: gemPos
				});

				// Increment gem position
				gemPos++;

				// When reach end of row, go to next row as long as not on last row
				if (col === self.gemsPerRow && row !== self.gemsPerRow) {
					// Reset col to 1
					col = 1;

					// Once reach end of row, increase row #
					row++;
				} else {
					// Go to next column number
					col++;
				}
			}

			// Trigger createNewGem
			self.$targ.trigger("createNewGem", {
				gems: gemsToCreate,
				callback: function (gems) {
					// Once reach last gem to create, change
					// state of creatingGems
					// Trigger addGems to add gem AND to scan rows and columns for
					// streaks ONLY after done creating gems
					self.$targ.trigger("addGems", { gems: gems });
				}
			});

			return self;
		},
		horizStreakCheck: function (gemPos) {
			var gem = this.gemset[gemPos],
					gemRow = gem[1],
					startGem = gemPos - (gem[2] - 1),
					$currentGem,
					islastGem,
					colorMatch,
					currentColor,
					col = 1,
					streak;

			while (col <= this.gemsPerRow) {
				$currentGem = $("#tile_gemPos_" + startGem);
				currentColor = this.gemset[startGem][0];
				islastGem = col === this.gemsPerRow;

				// If current gem color matches color to match
				if (currentColor === colorMatch) {
					streak++;

					// If last gem in row AND streak is less than 3,
					// don't mark as match and clear matched gems not part
					// of streak
					if (islastGem && (streak < 3)) {
						$(".gem_match.row_" + gemRow).not(".remove").removeClass("gem_match");
					} else {
						// Mark gem as a match to the previous one
						$currentGem.addClass("gem_match");
					}

					// Once hit 3 in a row, have a streak
					if (streak === 3) {
						// Mark past and current matched gems for removal
						$(".gem_match.row_" + gemRow).addClass("remove");

						// Set streaksExist flag to true
						this.streaksExist = true;
					} else if (streak > 3) {
						// Once go past 3 in a row, mark current gem for removal
						$currentGem.addClass("remove");
					}
				} else {
					// If streak didn't reach 3 in a row, then remove gem_match class
					// from previous gems NOT marked for removal
					if (streak < 3) {
						$(".gem_match.row_" + gemRow).not(".remove").removeClass("gem_match");
					}

					// If color doesn't match, then reset colorMatch to current gem
					// color
					colorMatch = currentColor;

					// Also reset streak to 1 with new gem
					streak = 1;

					// Finally mark current gem as a match so it can be
					// detected when a streak occurs UNLESS it's the last gem in row
					if (!islastGem) {
						$currentGem.addClass("gem_match");
					}
				}

				// Go to next gem position in row
				startGem++;

				// Go to next gem in row
				col++;
			}

			return this;
		},
		vertStreakCheck: function (gemPos) {
			var gem = this.gemset[gemPos],
					gemCol = gem[2],
					startGem = gemPos - ((gem[1] - 1) * this.gemsPerRow),
					$currentGem,
					colorMatch,
					currentColor,
					row = 1,
					streak;

			while (row <= this.gemsPerRow) {
				$currentGem = $("#tile_gemPos_" + startGem);
				currentColor = this.gemset[startGem][0];

				// If current gem color matches previous gem color
				if (currentColor === colorMatch) {
					// Increase streak by 1
					streak++;

					// If last gem in row AND streak is less than 3,
					// don't mark as match and clear matched gems not part
					// of streak
					if ((row === this.gemsPerRow) && (streak < 3)) {
						$(".gem_match.col_" + gemCol).not(".remove").removeClass("gem_match");
					} else {
						// Mark gem as a match to the previous one
						$currentGem.addClass("gem_match");
					}

					// Once hit streak of 3
					if (streak === 3) {
						// Mark all matched gems in the column for removal
						$(".gem_match.col_" + gemCol).addClass("remove");

						// Set streaksExist flag to true
						this.streaksExist = true;
					} else if (streak > 3) {
						// After 3 in a row, mark current gem for removal
						$currentGem.addClass("remove");
					}
				} else {
					// If streak hasn't reached 3, then remove gem_match class
					// from matched gems NOT marked for removal
					if (streak < 3) {
						$(".gem_match.col_" + gemCol).not(".remove").removeClass("gem_match")
					}

					// Reset color to match with current gem color
					colorMatch = currentColor;

					// Reset streak count to 1 starting with current gem
					streak = 1;

					// Mark current gem as match UNLESS it's last gem in column
					if (row !== this.gemsPerRow) {
						$currentGem.addClass("gem_match");
					}
				}

				// Go to next gem position in column
				startGem += this.gemsPerRow;

				// Go to next gem in column
				row++;
			}

			return this;
		},
		scanRowsCols: function (gemPos) {
			var self = this,
					i = 1,
					rowStartGem = i,
					max = this.gemsPerRow;

			// If no row or col param is specified, then scan all rows and columns
			if (!gemPos) {
				for (; i <= max; i++) {
					this.horizStreakCheck(rowStartGem);
					this.vertStreakCheck(i);

					// Grab start gem in next row
					rowStartGem += this.gemsPerRow;
				}
			} else {
				i = 0;
				max = gemPos.length - 1;

				for (; i <= max; i++) {
					this.horizStreakCheck(gemPos[i]);
					this.vertStreakCheck(gemPos[i]);
				}
			}

			// If streaks exist, trigger removeGems
			if (this.streaksExist) {
				setTimeout(function () {
					self.$targ.trigger("removeGems");
				}, 2000);
			} else {
				this.creatingGems = false;
				// If no streaks exist, check to see if there are at least
				// valid moves available. First check for possible horizontal streaks
				self._checkForValidHorizMoves();
			}

			return this;
		},
		removeGems: function () {
			var self = this,
					removedGems = {},
					gemPos,
					col,
					row,
					gemInGemset;

			[].forEach.call(self.$targ.find(".remove"), function (gem, idx, arr) {
				gemPos = gem.getAttribute("data-position");
				gemInGemset = self.gemset[gemPos];

				// The gem row will be used to help start
				row = gemInGemset[1];

				// The gem column will be the key in the removedGems object for reference
				col = gemInGemset[2];

				// Fade out gems to be removed and then remove them
				$(gem).fadeOut(300, function (e) {
					// Remove gem
					$(this).remove();

					// Also trigger scoreboard
					self.scoreboard.trigger("changeScore", { points: 10 });
				});

				// Keep track of what row the last gem removed in column is
        // If the gem col doesn't exist in removedGems object OR it does exist
        // AND the current gem row is greater than the gem col stored row is less than
        // current gem's row
        // Simply want to grab the bottom-most remove gem in each column
        if ((removedGems[col] && (removedGems[col][0]< row)) || !removedGems[col]) {
    				removedGems[col] = [row, col, gemPos];
        }
      });

			// Reset streaksExist flag once streak gems have been
			// removed.
			self.streaksExist = false;

			// After remove all gems, trigger moveGems to shift all gems into place
			self.$targ.trigger("moveGems", { removedGems: removedGems });

			return self;
		},
		moveGems: function (removedGems) {
			var self = this,
					gemsToCreate = [],
					gem,
					newGems = "",
					movingGemsCount = 0;

			// As cycle through all removedGems, each gem is passed
			// into moveGem to help shift all gems in the the removed gem column
			// to it's appropriate spot
			var moveGem = function (gemCol) {
				var col = gemCol[1],
						btmMostGemPos = gemCol[2],
						$colGem,
						i = 0,
						numGemsToCreate,
						removedCount = 0,
						newGems = "";

				// Set creatingGems flag to true
				this.creatingGems = true;

				// Another option that will avoid having to deal with changing
				// element orders when swap and query DOM is to just traverse through
				// gems in column by ID via gem pos -= this.gemsPerRow
				while (btmMostGemPos > 0) {
					// Grab gem in column starting at bottom-most removed gem
					$colGem = $("#tile_gemPos_" + btmMostGemPos);

					// If gem is to be removed
					if ($colGem.hasClass("remove")) {
						// Increment removedCount by 1
						removedCount++;

						// As remove gems, you can traverse column gems using removedCount
						// This will help determine which position the newly created gems
						// will fill since all gems in the column shift down to fill the
						// gaps once gems are removed.
						// Create new gems but don't append until after move existing
						// gems into place to fill gaps

						// TODO: Issue
						// Basically this should collected the gems that were removed
						// from each column, and then pass that data when triggering
						// the createNewGem event AFTER scanning of column is done.

						gemsToCreate.push({
							row: removedCount,
							col: col,
							gemPos: self._getGemPosition(removedCount, col)
						});

						if (btmMostGemPos < self.gemsPerRow) {
							self.creatingGems = true;

							self.$targ.trigger("createNewGem", {
								gems: gemsToCreate,
								callback: function (gems) {
									self.creatingGems = false;

									self.$targ.trigger("addGems", { gems: gems });
								}
							});
						}

					} else {
					movingGemsCount++;

						// Else move the unremoved gem down
					var gemPos = parseInt($colGem.attr("data-position"), 10),
							newPos = gemPos + (removedCount * self.gemsPerRow);

						// Update moved gem info in element attributes and gemset object
						self._updateGemInfo($colGem[0], newPos);

						// TODO: Test code
						$colGem.html("orig pos: " + gemPos + "<br \/>new pos: " + newPos + "<br \/>removed count: " + removedCount + "<br \/>move by: " + (removedCount * self.gemDimensions) + "<br \/>color in gemset: " + self.gemset[newPos][0]);

						$colGem.animate({
							top: "+=" + (removedCount * self.gemDimensions)
						}, {
							duration: 1500,
							complete: function () {
								movingGemsCount--;

								// Since using animation to move gems, we need to
								// only trigger new gem creation and addition when
								// last gem as finished moving. Otherwise, when you trigger
								// createNewGem, the this.gemset will update the gem colors
								// with the new ones generated, and then the gems being moved
								// will reference those when triggering updateGeminfo
								if (movingGemsCount < 1) {
									self.creatingGems = true;

									self.$targ.trigger("createNewGem", {
										gems: gemsToCreate,
										callback: function (gems) {
											self.creatingGems = false;

											self.$targ.trigger("addGems", { gems: gems });
										}
									});
								}
							}
						});
					}

					// Traverse up column to next gem
					btmMostGemPos -= self.gemsPerRow;
				}
			};

			// Cycle through removedGems object
			// Each gem in object is only bottom-most removed gem
			// This serves as starting point for scan
			for (gem in removedGems) {
				if (removedGems.hasOwnProperty(gem)) {
					moveGem(removedGems[gem]);
				}
			}

			return self;			
		},
		selectTile: function (gem) {
			var firstGem,
					adjacentGem,
					$gem = $(gem);

			// Check to see one has already been selected via a true/false flag
			if (this.gemSelected) {
				firstGem = this.targ.querySelector(".selected");
				adjacentGem = this._isAdjacentGem(firstGem, gem);

				// If clicking on first selected gem, remove selected state and reset
				// selected state
				if ($gem.hasClass("selected")) {
					$gem.removeClass("selected");
					this.gemSelected = false;
				}

				// FIRST => Second tile selected HAS to be on top/bottom/left/right of first in order to swap
				if (!adjacentGem) {
					return false;
				}

				// Since a tile is already selected, 
				this.$targ.trigger("swap", { gems: [firstGem, adjacentGem] });
			} else {
				// Add selected state to tile
				$gem.addClass("selected");

				// Change gemSelected state to true
				this.gemSelected = true;
			}

			return this;
		},
		swapGems: function (gem, otherGem, callback) {
			var self = this,
					gemPosX = gem.style.left,
					gemPosY = gem.style.top,
					othergemPosX = otherGem.style.left,
					othergemPosY = otherGem.style.top,

					// TODO: Test code
					gemPos = gem.getAttribute("data-position"),
					otherGemPos = otherGem.getAttribute("data-position");

			// Animate swap of tile positions
			$(gem).animate({
				top: othergemPosY,
				left: othergemPosX
			}, 500, function () {
				// TODO: Test code
				$(this).text(otherGemPos);
			});

			$(otherGem).animate({
				top: gemPosY,
				left: gemPosX
			}, 500, function () {

				// If a callback is provided, then invoke
				// This is done for timing purposes:
				// Only after gems have swapped and updated their info along
				// with the gemset info should we then scan rows/columns for streaks.
				if (callback) {
					callback(gem, otherGem);
				}

				// TODO: Test code
				$(this).text(gemPos);
			});

			// Remove selected state
			self.$targ.find(".selected").removeClass("selected");

			// Reset selected state
			self.gemSelected = false;

			return self;
		}
	};





	// Scoreboard constructor
	//  - A new instance of this is created on instantiation of new Bejeweled constructor.
	var Scoreboard = function (targ, opts) {
		this._construct.call(this, targ , opts || {});
	};

	Scoreboard.prototype = {
		_construct: function (targ, opts) {
			this.$targ = $(targ) || null;
			this.playerScore = opts.playerScore || null;

			// Keep track of score internally as faster than scanning DOM and grabbing text or attributes
			this.currentScore = 0;

			this._prep()._activate();

			return this;
		},
		_prep: function () {
			this.playerScore.text(0);

			return this;
		},
		_activate: function () {
			var self = this;

			// On changeScore event, update score
			self.$targ.on("changeScore", function (evt, data) {
				self.updateScore(data.points);
			});

			return this;
		},
		updateScore: function (points) {
			// Update currentScore
			this.currentScore += points;

			// On "remove" event for EACH gem, increment scoreboard by 10 pts.
			// Event should be triggered by each
			this.playerScore.text(this.currentScore);

			return this;
		}
	};

	// Create new Bejeweled game
	var bejeweledGame = new Bejeweled($(".gameboard"), {
		scoreboard: $("#game").find(".scoreboard")
	});

}(this, jQuery));