(function (global, $, undefined) {
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
			this.gemDimensions = opts.gemDimensions || 50;
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
			this._prep()._activate();

			// Create gameboard
			this.createGameboard();

			return this;
		},
		_prep: function () {
			// Any prep work that needs to be done

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
						self.scanRowsCols(data.gem);
					} else {
						console.log("scanning with no data");
						self.scanRowsCols();
					}
				},
				// Adds gem to gameboard
				"addGems": function (e, data) {
					// Add gems to board
					self.$targ.prepend(data.gems);

					// This should be triggered after ALL gems have been
					// created and prepended to the board
					// Trigger another scan for streaks
					if (!self.creatingGems) {
						self.$targ.trigger("scanRowsCols");
					}
				},
				"createNewGem": function (e, data) {
					if (data.callback) {
						data.callback(self.createNewGems(data.row, data.col, data.gemPos));
					}
				},
				// Gem swap
				"swap": function (e, data) {
					var gems = data.gems,
							i = 0,
							len = gems.length - 1;

					// Then trigger swapGems
					self.swapGems(gems[0], gems[1]);

					// Then scanRows and Cols
					for (; i <= len; i++) {
						self.$targ.trigger("scanRowsCols", { gem: gems[i].getAttribute("data-position")});
					}

					// If a streak is found, then remove the gems
					if (self.streaksExist) {
						self.$targ.trigger("removeGems");
					} else {
						// Otherwise swap gems back
						self.swapGems(gems[0], gems[1]);
					}

				}
			});

			// Bind click handlers to tiles
			self.$targ.on("click", ".tile", function (e) {
				self.selectTile(this);
			});

			return self;
		},
		_getGemPosition: function (row, col) {
				return (row * this.gemsPerRow) - (this.gemsPerRow - col);
		},
		// To easily grab gem info from gemset
		_fetchTileInfo: function (tile) {
			return this.gemset[tile.getAttribute("data-position")];
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
		_updateGemInfo: function (gemToUpdate, newPos) {
			var gemPos = gemToUpdate.getAttribute("data-position"),
					gemInSet = this.gemset[gemPos],
					newRow = this.gemset[newPos][1];

			// Row => current row (this.gemset[gemPos][1]) + removedCount
			gemToUpdate.className = "tile row_" + newRow + " col_" + gemInSet[2];

			// New data-position
			gemToUpdate.setAttribute("data-position", gemPos + newPos);

			// Update gem ID
			gemToUpdate.id = "tile_gemPos_" + newPos;

			// Update color of gem in gemset
			this.gemset[newPos][0] = gemInSet[0];

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
		createNewGems: function (row, col, gemPos) {
			var gemXPos = (col - 1) * this.gemDimensions,
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
					newGems = "";

			// Change creatingGems state to true when creating gameboard
			self.creatingGems = true;

			// Start from col 1 and go to max # gems per row
			// Once reach end, reset and go to next row until reach
			// last row (ie. row === this.gemsPerRow)
			while (col <= self.gemsPerRow) {
				// Trigger createNewGem event and pass in
				self.$targ.trigger("createNewGem", {
					row: row,
					col: col,
					gemPos: gemPos,
					callback: function (gem) {
						// Once reach last gem to create, change
						// state of creatingGems
						if ((row === self.gemsPerRow) && (col === self.gemsPerRow)) {
							self.creatingGems = false;
						}

						// Trigger addGems to add gem AND to scan rows and columns for
						// streaks ONLY after done creating gems
						self.$targ.trigger("addGems", { gems: gem });
					}
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

			console.log("After create gameboard");
			console.log(self.streaksExist);
			// If streaks exist, trigger removeGems
			if (self.streaksExist) {
				self.$targ.trigger("removeGems");
			}

			return self;
		},
		horizStreakCheck: function (gemPos) {
			// FOR CREATE GAMEBOARD
			// gemPos will always start at first gem in row


//			console.log("start gem: " + gemPos);
//			return;


			var gem = this.gemset[gemPos],
				gemRow = gem[1],
				startGem = gem[2] === this.gemsPerRow ? gemPos - (this.gemsPerRow - 1) : gemPos - ((gemPos % this.gemsPerRow) - 1),
				$currentGem,
				// From the beginning, the color to match should start off
				// being the first gem in the column
				colorToMatch,
				currentGemColor,
				// Start at second row
				col = 1,
				streak;

			while (col <= this.gemsPerRow) {
				// Grab the current gem element via data-position
				$currentGem = $(".tile[data-position=\"" + startGem + "\"]");

				// Grab current focused gem color
				currentGemColor = this.gemset[startGem][0];

				// If current gem color matches the previous gem color
				if (currentGemColor === colorToMatch) {
					// Increment streak counter
					streak++;

					// Mark this gem as a "match"
					$currentGem.addClass("gem_match");

					if (streak === 3) {
						// Once hit streak of 3 gems, mark those gems
						// for removal. This class will ensure they don't
						// get cleared out.
						$(".gem_match.row_" + gemRow).addClass("remove");

						console.log(document.querySelectorAll(".gem_match.row_" + gemRow));

						// Once hit this point there is a streak, so now this
						// flag can be accessed by all methods
						this.streaksExist = true;
					} else if (streak > 3) {
						// Once hit past 3 gems in a row, then just mark
						// current gem for removal
						$currentGem.addClass("remove");
					}
				} else {
					// If it doesn't match, then reset colorToMatch
					// to current gem's color
					// Grab current focused gem color
					colorToMatch = this.gemset[startGem][0];

					// If streak didn't reach 3 or more, then remove "match" class from
					// gems that aren't part of streak (this is marked with "remove" class)
					if (streak < 3) {
						$(".gem_match.row_" + gemRow).not(".remove").removeClass("gem_match");
					}

					// Restart streak and mark current gem to "match" EXCEPT if it's last gem
					// in row
					if (col !== this.gemsPerRow) {
						$currentGem.addClass("gem_match");
					}

					// Also reset streak to 1
					streak = 1;
				}

				// If at the last gem in column, clear out non-streak matching gems
				if (col === this.gemsPerRow) {
					$(".gem_match.row_" + gemRow).not(".remove").removeClass("gem_match");
				}

				// Increment position to next gem in row by adding 1
				// to startGem position. This will traverse through each
				// subsequent gem in the column in order until the last column
				startGem++;

				// Move to next gem in row
				col++;
			}

			return this;
		},
		vertStreakCheck: function (gemPos) {
			var gem = this.gemset[gemPos],
					gemCol = gem[2],
					startGem = gemPos - ((gem[1] - 1) * this.gemsPerRow),
					$currentGem,
					// From the beginning, the color to match should start off
					// being the first gem in the column
					colorToMatch,
					currentGemColor,
					// Start at second row
					row = 1,
					streak;

			while (row <= this.gemsPerRow) {
				// Grab the current gem element via data-position
				$currentGem = $(".tile[data-position=\"" + startGem + "\"]");

				// Grab current focused gem color
				currentGemColor = this.gemset[startGem][0];

				// If current gem color matches the previous gem color
				if (currentGemColor === colorToMatch) {
					// Increment streak counter
					streak++;

					// Mark this gem as a "match"
					$currentGem.addClass("gem_match");

					if (streak === 3) {
						// Once hit streak of 3 gems, mark those gems
						// for removal. This class will ensure they don't
						// get cleared out.
						$(".gem_match.col_" + gemCol).addClass("remove");

						// Once hit this point there is a streak, so now this
						// flag can be accessed by all methods
						this.streaksExist = true;
					} else if (streak > 3) {
						// Once hit past 3 gems in a row, then just mark
						// current gem for removal
						$currentGem.addClass("remove");
					}
				} else {
					// If it doesn't match, then reset colorToMatch
					// to current gem's color
					colorToMatch = this.gemset[startGem][0];

					// If streak didn't reach 3 or more, then remove "match" class from
					// gems that aren't part of streak (this is marked with "remove" class)
					if (streak < 3) {
						$(".gem_match.col_" + gemCol).not(".remove").removeClass("gem_match");
					}

					// Restart streak and mark current gem to "match" EXCEPT if it's last gem
					// in row
					if (row !== this.gemsPerRow) {
						$currentGem.addClass("gem_match");
					}

					// Also reset streak to 1
					streak = 1;
				}

				// If at the last gem in column, clear out non-streak matching gems
				if (row === this.gemsPerRow) {
					$(".gem_match.col_" + gemCol).not(".remove").removeClass("gem_match");
				}

				// Increment position to next gem in column by adding gemsPerRow
				// to startGem position. This will traverse through each
				// subsequent gem in the column in order until the last row
				startGem += this.gemsPerRow;

				// Move to next gem in col
				row++;
			}

			return this;
		},
		scanRowsCols: function (gemPos) {
			var i = 1,
					rowStartGem = i;

			// If no row or col param is specified, then scan all rows and columns
			if (!gemPos) {
				for (; i <= this.gemsPerRow; i++) {
					this.horizStreakCheck(rowStartGem);
					this.vertStreakCheck(i);

					// Grab start gem in next row
					rowStartGem += this.gemsPerRow;
				}
			} else {
				this.horizStreakCheck(gemPos);
				this.vertStreakCheck(gemPos);
			}

			// If streaks exist, trigger removeGems
//			if (this.streaksExist) {
//				this.$targ.trigger("removeGems");
//			}

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
			self.$targ.trigger("moveGems", {removedGems: removedGems});

			return self;
		},
		moveGems: function (removedGems) {
			var self = this,
					gem,
					newGems = "";

			console.log("=-=-=-=-=-=-MOVE GEMS=-=-=-=-=-=-");

			// As cycle through all removedGems, each gem is passed
			// into moveGem to help shift all gems in the the removed gem column
			// to it's appropriate spot
			var moveGem = function (gemCol) {
				var col = gemCol[1],
						btmMostGemPos = gemCol[2],
						$colGem,
						removedCount = 0,
						newGems = "";

//				console.log("btmMostGemPos: " + btmMostGemPos);

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

						// TODO: How get gemPos?
						//      (row * self.gemsPerRow) - (self.gemsPerRow - col)
						self.$targ.trigger("createNewGem", {
							row: removedCount,
							col: col,
							gemPos: self._getGemPosition(removedCount, col),
							callback: function (gem) {
								newGems += gem;
							}
						});
					} else {
//						$colGem.text(removedCount);
//						$colGem.text("removed: " + removedCount + " move by: " + (removedCount * self.gemDimensions));

						$colGem.animate({
							top: "+=" + (removedCount * self.gemDimensions)
						}, 800, function () {
							var gemPos = parseInt(this.getAttribute("data-position"), 10),
									newPos = gemPos + (removedCount * self.gemsPerRow);

							// Update moved gem info in element attributes and gemset object
							self._updateGemInfo(this, newPos);

							// TODO: Test code
							$(this).text(newPos);

						});
					}

					// Traverse up column to next gem
					btmMostGemPos -= self.gemsPerRow;
				}

				var addGem = setTimeout(function () {
					// Add new gems to gameboard
					// Append gems
					self.$targ.trigger("addGems", { gems: newGems });

					clearTimeout(addGem);
				}, 1000);
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
		swapGems: function (gem, otherGem) {
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
			}, 500);

			// Update the swapped gems so when we scan for gem streaks, we have the correct info
			self._updateSwappedTilesInfo(gem, otherGem);

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