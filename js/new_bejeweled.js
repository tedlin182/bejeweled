(function (global, $, undefined) {
	var noMovesOverlay = "<div class=\"overlay\"><p>No moves left.</p><\/div>";

	var Bejeweled = function (targ, opts) {
		this._construct.call(this, targ , opts || {});
	};

	Bejeweled.prototype = {
		_construct: function (targ, opts) {
			var self = this;

			// Defined new properties
			this.$targ = $(targ) || null;
			this.targ = this.$targ[0] || null;

			// Gameboard will always be a square, so # of rows = #of cols;
			this.gemsPerRow = opts.gemsPerRow || 4;
			this.gemDimensions = opts.gemDimensions || 50;
			this.gemColors = opts.tileColors || ["blue", "green", "yellow", "red", "grey", "orange", "magenta", "black", "lightblue"];
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
			this._prep()._activate();

			// Create gameboard
			this.createGameboard();

			return this;
		},
		_prep: function () {
			// Set height of gameboard to height of all gems
			this.targ.style.height = (this.gemDimensions * this.gemsPerRow) + "px";

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
					var movingGemsCount = 0;

					// Add gems to board
					self.$targ.prepend(data.gems);

					[].forEach.call(self.$targ.find(".move"), function (gem, idx, arr) {
						var $this = $(gem),
								gemInGemset = self._fetchGemInfo(gem),
								gemPosY = (gemInGemset[1] - 1) * self.gemDimensions;

						// TODO: Refactor
						// Increment moving gem count to track when
						// all gems have finished moving
						movingGemsCount++;

						// Remove "move" class from gem
						$this.removeClass("move");

						$this.animate({
							top: gemPosY + "px"
						}, {
							duration: 800,
							complete: function () {
								// Once done moving, decrement count
								movingGemsCount--;

								// Once finished moving all gems, trigger scan
								// rows
								if (movingGemsCount < 1) {
									self.$targ.trigger("scanRowsCols");

									if (data.callback) {
										data.callback();
									}
								}
							}
						});
					});
				},
				"createNewGem": function (e, data) {
						var gems = data.gems,
								callback = data.callback,
								i = 0,
								len = gems.length - 1,
								newGems = "";

						// data.gems is an array or gem attributes
						// (ie. row, col, gemPos)
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

							self.gemSelected = false;
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
		_getGemPosition: function (row, col) {
				return (row * this.gemsPerRow) - (this.gemsPerRow - col);
		},
		// To easily grab gem info from gemset
		_fetchGemInfo: function (gem) {
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
		createNewGems: function (data) {
			var row = data.row,
					col = data.col,
					gemPos = data.gemPos,
					gemXPos = (col - 1) * this.gemDimensions,
					startYPos = (this.gemsPerRow - row) * this.gemDimensions,
					gemRow = "row_" + row,
					gemCol = "col_" + col,
					gemColor = this._setGemColor(),
					gem;

			// As create gems, store gem info and gem order in an object for easy info access.
			// Much faster than scanning DOM
			this.gemset[gemPos] = [gemColor, row, col];

			// Need reference to gems removed and new gems take their spot
			// both in the DOM and in this.gemset
			gem = "<div id=\"tile_gemPos_" + gemPos + "\" class=\"tile " + gemRow + " " + gemCol + " move\" style=\"background-color: " + gemColor + "; top: -" + startYPos + "px; left: " + gemXPos + "px; width: " + this.gemDimensions + "px; height: " + this.gemDimensions + "px; \" data-position=\"" + gemPos + "\"><\/div>";

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
				// TODO: Refactor
				// Need to do countdown of gemsRemoving
				setTimeout(function () {
					self.$targ.trigger("removeGems");
				}, 500);
			} else {
				this.creatingGems = false;
				// If no streaks exist, check to see if there are at least
				// valid moves available. First check for possible horizontal streaks
				self._checkForValidMoves();
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
					movingGemsCount = 0;

			// As cycle through all removedGems, each gem is passed
			// into moveGem to help shift all gems in the the removed gem column
			// to it's appropriate spot
			var moveGem = function (gemCol) {
				var col = gemCol[1],
						btmMostGemPos = gemCol[2],
						$colGem,
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

						// Add data for new gem to be created and add to gemsToCreate
						// collection. This array will be passed into createNewGem
						// whenever gems are done moving (if need be) or bottom-most
						// gems removed are on the first row
						gemsToCreate.push({
							row: removedCount,
							col: col,
							gemPos: self._getGemPosition(removedCount, col)
						});

						// If bottom-most gems removed are on the first row, then
						// there won't be any moving of gems, so just create new ones
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
						// This is to keep track of how many gems are still moving
						// This will help with timing of when to trigger new gems to be
						// created (due to animation duration) and when they'll be added
						// to the board.
						movingGemsCount++;

						$colGem.animate({
							top: "+=" + (removedCount * self.gemDimensions)
						}, {
							duration: 600,
							complete: function () {
								// Once a gem is done moving, decrement count
								movingGemsCount--;

								// Else move the unremoved gem down
								var gemPos = parseInt(this.getAttribute("data-position"), 10),
									newPos = gemPos + (removedCount * self.gemsPerRow);

								// Update moved gem info in element attributes and gemset object
								self._updateGemInfo(this, newPos);

								// Since using animation to move gems, we need to
								// only trigger new gem creation and addition when
								// last gem as finished moving. Otherwise, when you trigger
								// createNewGem, the this.gemset will update the gem colors
								// with the new ones generated, and then the gems being moved
								// will reference those when triggering updateGeminfo
								if (movingGemsCount < 1) {
									// Once we finish moving all the gems, start creating
									// new gems and set flag to true
									self.creatingGems = true;

									// Create new gems
									self.$targ.trigger("createNewGem", {
										gems: gemsToCreate,
										callback: function (gems) {
											// Once all gems have been created, set creatingGems
											// flag to false
											self.creatingGems = false;

											// Then add the new gems to the board
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
					othergemPosY = otherGem.style.top;

			// Animate swap of tile positions
			$(gem).animate({
				top: othergemPosY,
				left: othergemPosX
			}, 500);

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