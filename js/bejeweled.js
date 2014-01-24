/**
 * Bejeweled Game
 *
 * 	=> Need to track the following
 * 			- removed gem count
 * 			- moving gems count
 * 			- if creating gems
 * 				=> Set to true when just start creating gems
 * 				=> Set to false when finished adding gems
 * 			- if a streak exists
 * 				=> Set to true when scanning rows and columns
 * 				=> Set to false when those gems are ALL removed (this will happen
 * 					 after removeGems has completed and removedGemCount === 0)
 * 			- if valid moves exist
 *				=> Set to true during _checkForValidMoves()
 *				=> Set to false when
 */



(function (global, $, undefined) {
	var noMovesOverlay = "<div class=\"overlay\"><p>No moves left.</p><\/div>";

	var Bejeweled = function (targ, opts) {
		this._construct.call(this, targ , opts || {});
	};

	Bejeweled.prototype = {
		_construct: function (targ, opts) {
			// Ohe gameboard wrapped in jQuery
			this.$targ = $(targ) || null;

			// Native DOM element of gameboard
			this.targ = this.$targ[0] || null;

			// Gameboard will always be a square, so # of rows = #of cols;
			this.gemsPerRow = opts.gemsPerRow || 8;

			// Dimensions of gems
			this.gemDimensions = opts.gemDimensions || 50;

			// List of possible colors for gems
			this.gemColors = opts.tileColors || ["blue", "green", "yellow", "red", "grey", "orange", "magenta", "black", "lightblue"];

			// The scoreboard element to trigger updateScore event
			this.scoreboard = opts.scoreboard || null;

			// Gemset to store gem order and gem info
			this.gemset = {};

			// Set gemSelected flag
			this.gemSelected = false;

			// Set container for removed gems
			// This should clear out after gems have been removed
			this.removedGems = {};

			// Track if done creating new gems
			this.creatingGems = false;

			// Keep track to see if gem streaks exist
			this.streaksExist = false;

			// See if valid moves exist
			this.validMovesExist = false;

			// Track moving gems
			this.movingGemsCount = 0;

			// Track removing gems
			this.removedGemsCount = 0;

			// Track swapping gems
			this.swappingGemsCount = 0;

			// Do prep work and then event bindings
			this._prep()._activate();

			// Create new gameboard after event bindings
			this.createGameboard();
		},
		_prep: function () {
			// Set height of gameboard to height of all gems
			this.targ.style.height = (this.gemDimensions * this.gemsPerRow) + "px";

			// Create new scoreboard
			this.bejeweledScoreboard = new Scoreboard(this.scoreboard, {
				playerScore: this.scoreboard.find(".score")
			});

			return this;
		},
		_activate: function () {
			var self = this;

			self.$targ.on({
				"createNewGem": function (e, data) {
					self.createNewGems(data.gems);
				},
				"moveGems": function (e, data) {
					var callback = data ? data.callback : null;

					self.moveGems(callback);
				},
				"scanRowsCols": function (e, data) {
					var gems = data ? data.gems : null;

					self.scanRowsCols(gems);
				},
				// This removes the streaks of gems
				"removeGems": function (e, data){
					self.removeGems();
				},
				// Gem swap
				"swap": function (e, data) {
					var gems = data.gems;

					self.swapGems(gems[0], gems[1], function (gem, otherGem) {
						if (!self.streaksExist) {
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
		// This should only happen on successful swap (and then also removal)
		_updateSwappedTilesInfo: function (gem, otherGem) {
			var gemPos = gem.getAttribute("data-position"),
					otherGemPos = otherGem.getAttribute("data-position"),
					gemInGemset = this.gemset[gemPos],
					otherGemInGemset = this.gemset[otherGemPos],
					gemColor = gemInGemset[0],
					otherGemColor = otherGemInGemset[0],
					gemClass = gem.className,
					otherGemClass = otherGem.className,
					gemId = gem.id,
					otherGemId = otherGem.id;

			// Swap colors
			gemInGemset[0] = otherGemColor;
			otherGemInGemset[0] = gemColor;

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
		_updateGemInfo: function (gemToUpdate, newPos) {
			var gemInSet = this.gemset[gemToUpdate.getAttribute("data-position")],
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
		_shiftGems: function () {
			var self = this,
					gemsToCreate = [],
					col;

			// This is run for each column
			var markForMove = function (gemCol, removedGems) {
				var i = parseInt(removedGems.gemPos, 10),
						colNum,
						gem,
						removedCount = 0;

				// Start at bottom-most removed gem in column and traverse
				// through gems
				while (i > 0) {
					// Find gem
					gem = document.getElementById("tile_gemPos_" + i);

					// If gem doesn't exist, it has already been removed
					// so increment removedCount
					if (!self.gemset[i][0]) {
						colNum = parseInt(gemCol, 10);

						// Increment removed count
						removedCount++;

						// Create new objects of new gems to be created for the column
						gemsToCreate.push({
						 	row: removedCount,
							col: colNum,
							gemPos: ((removedCount - 1) * self.gemsPerRow) + colNum
						});
					} else {
						// Update gem attribute with new position
						self._updateGemInfo(gem, (i + (removedCount  * self.gemsPerRow)));

						// Mark gem to move
						$(gem).addClass("move");
					}

					// Traverse up column starting at bottom-most removed gem
					// in column
					i -= self.gemsPerRow;
				}
			};

			// Scan this.removedGems object to see what gems have been removed
			for (var col in self.removedGems) {
				if (self.removedGems.hasOwnProperty(col)) {
					markForMove(col, self.removedGems[col]);
				}
			}

			// Trigger moveGems once done updating gems
			self.$targ.trigger("moveGems", {
				callback: function (gem) {
					// New gems for each column will then be created
					self.$targ.trigger("createNewGem", { gems: gemsToCreate });

					// Once new gems have been added, trigger them to move into place
					self.$targ.trigger("moveGems");
				}
			});

			return self;
		},
		_checkSurroundingGems: function (data) {
			var pos = data.gemPos,
				currentGem = data.currentGem,
				row = this.gemset[pos][1],
				col = this.gemset[pos][2],
				rowCol = data.isColumnScan ? col : row,
				prevGem = pos - 1,
				nextGem = pos + 1,
				gemAbove = pos - this.gemsPerRow,
				gemBelow = pos + this.gemsPerRow,
				isNotFirstGem = col !== 1,
				isNotLastGem = col !== this.gemsPerRow,
				surroundingGems = [],
				notLastRowCol = rowCol !== this.gemsPerRow,
				notFirstRowCol = rowCol > 1,
				i = 0,
				len;

			// If scanning column, reset variables to correspond
			// appropriately to gems in column
			if (data.isColumnScan) {
				prevGem = gemAbove;
				nextGem = gemBelow;

				gemAbove = pos - 1;
				gemBelow = pos + 1;

				isNotFirstGem = row !== 1;
				isNotLastGem = row !== this.gemsPerRow;
			}

			// If not at last row/column, then check gem to right
			if (notLastRowCol) {
				surroundingGems.push(gemBelow);
			}

			// If not at first column, then check gem to left
			if (notFirstRowCol) {
				surroundingGems.push(gemAbove);
			}

			// If a gap doesn't exist, then check top/bottom depending
			// on if start or end
			if (!data.gapExists) {
				// Gem is before the streak and is not the first gem in the row/column
				if ((pos < currentGem) && isNotFirstGem) {
					surroundingGems.push(prevGem);
				}

				// Gem is below current gem and is not the last gem in the column
				if ((pos > currentGem) && isNotLastGem) {
					surroundingGems.push(nextGem);
				}
			}

			// Define length of array here after all gems have been added
			// to surroundingGems
			len = surroundingGems.length - 1;

			// Check gems
			for (; i <= len; i++) {
				// If one of the surrounding gems matches the color to match,
				// then valid moves exist and can break out of loop
				if (this.gemset[surroundingGems[i]][0] === data.colorMatch) {
					this.validMovesExist = true;
					return true;
				}
			}

			return false;
		},
		_checkForValidMoves: function (isColumnScan) {
			var self = this,
				gapExists = false,
				gem,
				rowColToScan,
				prevGem,
				gemData,
				totalGems = Math.pow(this.gemsPerRow, 2),
				gemPos = 1,
				isStart,
				isEnd,
				colorMatch,
				gemColor2back,
				currentColor,
				nextGemInRowCol,
				gemTwoPrev;

			// Cycle through all gems
			while (gemPos <= totalGems) {
				// Grab gem in gemset
				gem = self.gemset[gemPos];
				currentColor = gem[0];

				rowColToScan = isColumnScan ? gem[1] : gem[2];
				nextGemInRowCol = isColumnScan ? gemPos + self.gemsPerRow : gemPos + 1;

				// If doing column scan redefine these variables
				prevGem = isColumnScan ? gemPos - self.gemsPerRow : gemPos - 1;
				gemTwoPrev = isColumnScan ? gemPos - (2 * self.gemsPerRow) : gemPos - 2;

				isStart = rowColToScan === 2;
				isEnd = rowColToScan === self.gemsPerRow;

				gemData = {
					currentGem: gemPos,
					gapExists: gapExists,
					colorMatch: colorMatch,
					isStart: isStart,
					isEnd: isEnd,
					isColumnScan: isColumnScan
				};

				// If current gem matches (this will be for streak of 2 in a row)
				if (currentColor === colorMatch) {
					// 2 in a row so no gap which needs to be passed into
					// gemData
					gemData.gapExists = false;

					// If not a the start of the row/column
					// grab the gem 2 before (gem before streak) and check
					// surrounding gems
					if (!isStart) {
						gemData.gemPos = gemTwoPrev;

						// First check the gem at the end of the row
						self._checkSurroundingGems(gemData);
					}

					// If not a the end of the row/column
					// grab the gem after (gem before streak) and check
					// surrounding gems
					if (!isEnd) {
						gemData.gemPos = nextGemInRowCol;

						// First check the gem at the end of the row
						self._checkSurroundingGems(gemData);
					}

					// If valid moves exist
					if (self.validMovesExist) {
						// Reset flag
						self.validMovesExist = false;

						return this;
					} else {
						// If no valid moves exist, start over
						colorMatch = currentColor;

						// And reset gapExists overall flag
						gapExists = false;
					}
				} else {
					// If a gap already exists and color still not matching,
					if (gapExists) {
						// Check to see if current gem color matches the color
						// of the gem 2 back
						if (currentColor === gemColor2back) {
							// Make gem to check its surrounding
							// gems the previous one in row/col
							gemData.gemPos = prevGem;
							gemData.colorMatch = currentColor;

							// Check surrouding gems
							self._checkSurroundingGems(gemData);

							// If valid moves exist
							// Break out of loop
							if (self.validMovesExist) {
								// Reset flag
								self.validMovesExist = false;

								return this;
							} else {
								// Restart
								gapExists = false;

								// Reset gem2back to previous gem (which will be
								// 2 back from next gem)
								gemColor2back = self.gemset[prevGem][0];
							}
						} else {
							// If current gem color doesn't match, then update gemColor2back to color of
							// previous gem
							gemColor2back = self.gemset[prevGem][0];
						}

					} else if (rowColToScan !== 1) {
						// If gap doesn't exist and current gem color doesn't match,
						// then this current gem is creating a gap
						gapExists = true;

						// Because we want to see if next gem color matches the color
						// of the gem previous to this one, we store it in memory
						gemColor2back = this.gemset[prevGem][0];
					}

					// Whenever gem color doesn't match color to match,
					// we reset color to match to current gem's color
					colorMatch = currentColor;
				}


				// Once hit last gem in column/row, need to reset colorMatch
				// and gapExists flag
				if (rowColToScan === self.gemsPerRow) {
					colorMatch = null;

					// Reset gap exists flag when start on new row
					gapExists = false;

					// As long as not at last row/column, once hit last gem in column
					// next gem will be first gem in next column

					// If we are scanning a column, we need to move to the next column
					// so we set next gem to be first gem in next column.
					// HOWEVER, if we are in the last column, do nothing

					if (isColumnScan) {
						if (gem[2] < self.gemsPerRow) {
							gemPos = gem[2] + 1;
						}
					}
				}

				// Move to next gem
				if (isColumnScan) {
					// Move to next gem
					gemPos += self.gemsPerRow;
				} else {
					gemPos++;
				}
			}

			// If no valid moves exist, create a new gameboard
			if (!self.validMovesExist) {
				if (isColumnScan) {
					self.$targ.append(noMovesOverlay);

					self.$targ.find(".overlay").fadeOut(3000, function () {
						// Remove overlay
						$(this).remove();

						// Empty gameboard
						self.targ.innerHTML = "";

						// Trigger create new gameboard
						self.createGameboard();
					});
				} else {
					// Reset next gem
					nextGemInRowCol = null;

					// If only scanned row and now
					self._checkForValidMoves(true);
				}
			} else {
				// Reset flag
				self.validMovesExist = false;
			}

			return this;
		},
		/**
		 * Create New Gems
		 * 	- Used when create new gameboard, or adding new gems after gems
		 * 		have been removed
		 * @param gems - Array of objects containing each gem's attributes
		 * 							 (eg. row, col, gemPos)
		 * @returns {Bejeweled}
		 */
		createNewGems: function (gems) {
			var row,
					col,
					gemPos,  // This should be stored as in data
					gemXPos,
					gemColor,
					gem,
					gemsToBeAdded = "",
					i = 0,
					totalGems = gems.length - 1;

			// Set creatingGems flag to true
			this.creatingGems = true;

			for (; i <= totalGems; i++) {
				gem = gems[i];
				row = gem.row;
				col = gem.col;
				gemPos = gem.gemPos;  // This should be stored as in data
				gemXPos = (col - 1) * this.gemDimensions;
				gemColor = this._setGemColor();

				// As create gems, store gem info and gem order in an object for easy info access.
				// Much faster than scanning DOM
				this.gemset[gemPos] = [gemColor, row, col];

				// Need reference to gems removed and new gems take their spot
				// both in the DOM and in this.gemset
				// Gems starting "top" position is above gameboard
				// Once added to the board, we will trigger the gems to move
				gemsToBeAdded += "<div id=\"tile_gemPos_" + gemPos + "\" class=\"tile row_" + row + " col_" + col + " move\" style=\"background-color: " + gemColor + "; top: -" + (this.gemsPerRow * this.gemDimensions) + "px; left: " + gemXPos + "px; width: " + this.gemDimensions + "px; height: " + this.gemDimensions + "px; \" data-position=\"" + gemPos + "\"><\/div>";
			}

			// Add gems to
			this.$targ.append(gemsToBeAdded);
//
//			// Once gems have been added, trigger moveGems
//			this.$targ.trigger("moveGems");

			// Need to also store gemPos in $.data so can't be modified
			return this;
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
			self.$targ.trigger("createNewGem", { gems: gemsToCreate });

			// Once gems have been added, trigger moveGems
			self.$targ.trigger("moveGems");

			return self;
		},
		moveGems: function (callback) {
			var self = this;

			// Move all gems into place
			[].forEach.call(self.$targ.find(".move"), function (gem, idx, arr) {
				var $gem = $(gem),
						gemInGemset = self.gemset[gem.getAttribute("data-position")],
						gemPosY = (gemInGemset[1] - 1) * self.gemDimensions;

				// Increment moving gem count to track when
				// all gems have finished moving
				self.movingGemsCount++;

				// Remove "move" class from gem
				$gem.removeClass("move");

				$gem.animate({
					top: gemPosY + "px"
				}, {
					duration: 800,
					complete: function () {
						// Once done moving, decrement count
						self.movingGemsCount--;

						// Once finished moving all gems, trigger scan
						// rows
						if (self.movingGemsCount < 1) {
							// If a callback exists, invoke it
							if (callback) {
								callback($gem);
							} else {
								// Done moving gems
								self.creatingGems = false;

								// Reset streaksExist flag
								self.streaksExist = false;

								// Need to add gems, trigger add gems

								// Else, trigger scanRowCols
								self.$targ.trigger("scanRowsCols");
							}
						}
					}
				});
			});
		},
		/**
		 * 	Scan Rows and Columns
		 * @param gems [array] - These are gem positions and from these we will
		 * access the rows/cols from this.gemset and scan these
		 */
		scanRowsCols: function (gems) {
			var i = 0,
					len,
					row;

			// If an array of specific gem positions are passed in, then
			// iterate through and scan each row/column
			if (gems) {
				len = gems.length - 1;

				for (; i <= len; i++) {
					this.scanForRowStreak(gems[i]);
					this.scanForColumnStreak(gems[i]);
				}
			} else {
				i = 1;
				row = i;
				len = this.gemsPerRow;

				for (; i <= len; i++) {
					this.scanForRowStreak(row);
					this.scanForColumnStreak(i);

					row += this.gemsPerRow;
				}
			}

			// If streaks exist, trigger "removeGems"
			if (this.streaksExist) {
				this.$targ.trigger("removeGems");
			} else {
				this.creatingGems = false;
				// If no streaks exist, check to see if there are at least
				// valid moves available. First check for possible horizontal streaks
				this._checkForValidMoves();
			}

			return this;
		},
		scanForRowStreak: function (gemPos) {
			// Grab 1st gem in row
			var gemToScan = this.gemset[gemPos],
					gem,
					gemRow = gemToScan[1],
					firstGem = gemPos - (gemToScan[2] - 1),
					currentGemPos = firstGem,
					gemNumInRow = 1,
					$currentGem,
					currentColor,
					colorToMatch,
					streak = 1;

			while (gemNumInRow <= this.gemsPerRow) {
				$currentGem = $(".row_" + gemRow + ".col_" + gemNumInRow);
				gem = this.gemset[currentGemPos];
				currentColor = gem[0];

				// If currentColor matches colorToMatch
				if (currentColor === colorToMatch) {
					// Increment streak count by 1
					streak++;

					// Mark gem as a "match" with "gem_match" class
					$currentGem.addClass("gem_match");

					// If streak hits 3
					if (streak === 3) {
						// Add "remove" to matched gems part of streak
						$(".gem_match.row_" + gemRow).addClass("remove");

						// Flip streaks flag to true
						this.streaksExist = true;
					} else if (streak > 3) {
						// After 3 in a row, mark current gem for removal
						$currentGem.addClass("remove");
					}
				} else {
					// If currentColor does NOT match colorToMatch

					// If have a streak of less than 3, remove "gem_match" class
					// from gems that aren't marked for removal (aka. part of a streak)
					if (streak < 3) {
						$(".gem_match.row_" + gemRow).not(".remove").removeClass("gem_match");
					}

					if (gemNumInRow === this.gemsPerRow) {
						// If last gem in the row, reset colorToMatch to null
						colorToMatch = null;
					} else {
						// Set colorToMatch to current gem color
						colorToMatch = currentColor;

						// Mark gem as a "match" with "gem_match" class as it's
						// the start of a new streak potentially
						$currentGem.addClass("gem_match");
					}

					// Reset streak to 1
					streak = 1;
				}

				// If hit end of row, remove gem_match class from gems not to be
				// removed
				if (gemNumInRow === this.gemsPerRow) {
					$(".gem_match.row_" + gemRow).not(".remove").removeClass("gem_match");
				}

				// Get next gem position in row
				currentGemPos++;

				// Go to next gem in row
				gemNumInRow++;
			}


			return this;
		},
 		scanForColumnStreak: function (gemPos) {
			// Grab 1st gem in row
			var gemToScan = this.gemset[gemPos],
					gem,
					gemCol = gemToScan[2],
					firstGem = gemPos - ((gemToScan[1] - 1) * this.gemsPerRow),
					currentGemPos = firstGem,
					gemNumInCol = 1,
					$currentGem,
					currentColor,
					colorToMatch,
					streak = 1;

			while (gemNumInCol <= this.gemsPerRow) {
				$currentGem = $(".row_" + gemNumInCol + ".col_" + gemCol);
				gem = this.gemset[currentGemPos];
				currentColor = gem[0];

				// If currentColor matches colorToMatch
				if (currentColor === colorToMatch) {
					// Increment streak count by 1
					streak++;

					// Mark gem as a "match" with "gem_match" class
					$currentGem.addClass("gem_match");

					// If streak hits 3
					if (streak === 3) {
						// Add "remove" to matched gems part of streak
						$(".gem_match.col_" + gemCol).addClass("remove");

						// Flip streaks flag to true
						this.streaksExist = true;
					} else if (streak > 3) {
						// After 3 in a row, mark current gem for removal
						$currentGem.addClass("remove");
					}
				} else {
					// If currentColor does NOT match colorToMatch

					// If have a streak of less than 3, remove "gem_match" class
					// from gems that aren't marked for removal (aka. part of a streak)
					if (streak < 3) {
						$(".gem_match.col_" + gemCol).not(".remove").removeClass("gem_match");
					}

					if (gemNumInCol === this.gemsPerRow) {
						// If last gem in the row, reset colorToMatch to null
						colorToMatch = null;
					} else {
						// Set colorToMatch to current gem color
						colorToMatch = currentColor;

						// Mark gem as a "match" with "gem_match" class as it's
						// the start of a new streak potentially
						$currentGem.addClass("gem_match");
					}

					// Reset streak to 1
					streak = 1;
				}

				// If hit end of column, remove gem_match class from gems not to be
				// removed
				if (gemNumInCol === this.gemsPerRow) {
					$(".gem_match.col_" + gemCol).not(".remove").removeClass("gem_match");
				}

				// Get next gem position in row
				currentGemPos += this.gemsPerRow;

				// Go to next gem in row
				gemNumInCol++;
			}

			return this;
		},
		removeGems: function () {
			var self = this;

			// Cycle through each gem to be removed
			[].forEach.call(self.$targ.find(".remove"), function (removedGem, idx, arr) {
				var gemPos = removedGem.getAttribute("data-position"),
						gem = self.gemset[gemPos],
						gemCol = gem[2];

				// Null out color for gem in gemset
				// Will help in detecting removed gems in _shiftGems
				self.gemset[gemPos][0] = null;

				// Increment removedGemsCount to track progress of removal
				self.removedGemsCount++;

				// We only care about the gems removed per column since we shift
				// unremoved gems down after gems are removed
				self.removedGems[gemCol] = {
					row: gem[1],
					col: gemCol,
					gemPos: gemPos
				};

				$(removedGem).fadeOut({
					duration: 800,
					complete: function () {
						// Remove gem
						$(this).remove();

						// Decrement removedGemsCount as each gem is removed
						self.removedGemsCount--;

						// Also trigger scoreboard
						self.scoreboard.trigger("changeScore", { points: 10 });

						// Once we remove the last gem, move the remaining gems into gaps
						if (self.removedGemsCount < 1) {
							self._shiftGems();
						}
					}
				});
			});

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
					$gem.removeClass("selected swap");
					this.gemSelected = false;
				}

				// FIRST => Second tile selected HAS to be on top/bottom/left/right of first in order to swap
				if (!adjacentGem) {
					return false;
				}

				// Mark other gem to swap
				$(adjacentGem).addClass("selected swap");

				// Since a tile is already selected,
				this.$targ.trigger("swap", { gems: [firstGem, adjacentGem] });
			} else {
				// Add selected state to tile
				$gem.addClass("selected swap");

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
					gemPos = parseInt(gem.getAttribute("data-position"), 10),
					otherGemPos = parseInt(otherGem.getAttribute("data-position"), 10);

			// When swapping, total number of gems being swapped is 2,
			// so we start count here;
			self.swappingGemsCount = 2;

			// Animate swap of tile positions
			$(gem).animate({
				top: othergemPosY,
				left: othergemPosX
			}, {
				duration: 500,
				complete: function () {
					// Once one is done swapping, decrement count
					self.swappingGemsCount--;
				}
			});

			$(otherGem).animate({
				top: gemPosY,
				left: gemPosX
			}, {
				duration: 500,
				complete: function () {
					// Once one is done swapping, decrement count
					self.swappingGemsCount--;

					// Once all gems have finished swapping
					if (self.swappingGemsCount < 1) {
						// Update gemset info and both gem attributes
						self._updateSwappedTilesInfo(gem, this);

						self.$targ.trigger("scanRowsCols", { gems: [gemPos, otherGemPos] });

						// If a callback is provided, then invoke
						if (callback) {
							callback(gem, this);
						}
					}
				}
			});

			// Remove selected and swap state
			self.$targ.find(".selected").removeClass("selected swap");

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