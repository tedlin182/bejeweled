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

			// On "remove" event, invoke removeGem() method

			self.$targ.on({
				// This removes the streaks of gems
				"removeGems": function (e, data){
					self.removeGems();
				},
				// Once gems are removed, this event shifts gems down into fill the gaps
				"moveGems": function (e, data) {
					self.moveGems(data.removedGems);
				},
				// Gem swap
				"swap": function (e, data) {
					var gems = data.gems,
							i = 0,
							len = gems.length - 1,
							gem;

							console.log(gems);
					// Cycle through gems that were swapped and scan both columns and rows
					// for each gem for streaks
					for (; i <= len; i++) {
						gem = gems[i];
						self.scanRowsCols(".row_" + gem[1], ".col_" + gem[2]);
					}
				}
			});

			// Bind click handlers to tiles
			self.$targ.on("click", ".tile", function (e) {
				self.selectTile(this);
			});

			return self;
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
		_hasHorizontalStreak: function (row) {
			var $row = $(row),
					$gem,
					gemPos,
					gemToMatch = null,
					gemColor,
					streak = 1,
					i = 1,
					len = $row.length;

			// With updated this.gemset, determine gems to scan, cycle through to determine
			// streaks and mark them for removal

			// Loop through all gems in the row
			for (; i <= len; i++) {
				// Since the index order of the swapped gems doesn't swap evenly when moved
				// to a different row, use the "col_[x]" class to traverse the row in the correct order
				$gem = $(row + ".col_" + i);
				gemPos = $gem.attr("data-position");

//				if (!this.gemset[gemPos]) {
//				console.log("_hasHorizontalStreak");
//				console.log("gempos: " + gemPos);
//				console.log(this.gemset);
//				}

				gemColor = this.gemset[gemPos][0];
				
				$gem.text(gemPos);

				// If gemToMatch not set OR if gem color doesn't match gemToMatch
				if (!gemToMatch || gemToMatch !== gemColor) {
					// Reset gemToMatch to current gem color
					gemToMatch = gemColor;

					// If streak didn't reach 3 or more, then remove "match" class from 
					// gems that aren't part of streak (this is marked with "remove" class)
					if (streak < 3) {
						$(row + ".gem_match").not(".remove").removeClass("gem_match");
					}

					// Restart streak and mark current gem to "match" EXCEPT if it's last gem
					// in row
					if (i !== len) {
						$gem.addClass("gem_match");
					}

					// Also reset streak to 1
					streak = 1;
				} else if (gemToMatch === gemColor) {
					// Increase streak
					streak++;

					// Mark current gem as "match"
					$gem.addClass("gem_match");

					// Once hit streak of 3 or more, add "remove" class to current gem
					// AND previous gems. By this point there shouldn't be any other gems
					// marked as "match" as it would have cleared with the above check
						
					// Once streak hits 3, mark previous "matched" gems for removal
					if (streak === 3) {
						$(row + ".gem_match").addClass("remove");
					} else if (streak > 3) {
						// Every matching gem after that, mark to "remove" individually
						$gem.addClass("remove");
					}
				}

				// If at the last gem in row, clear out non-streak matching gems
				if (i === len) {
					$(row + ".gem_match").not(".remove").removeClass("gem_match");
				}
			}
			
			return this;
		},
		_hasVerticalStreak: function (col) {
			var $col = $(col),
					$gem,
					gemPos,
					gemToMatch = null,
					gemColor,
					streak = 1,
					i = 1,
					len = $col.length;
			
			// Loop through all gems in the row
			for (; i <= len; i++) {
				$gem = $(col + ".row_" + i);
				gemPos = $gem.attr("data-position");


//				if (!this.gemset[gemPos]) {
//				console.log("_hasVerticalStreak");
//				console.log("gempos: " + gemPos);
//				console.log(this.gemset);
//				}

				gemColor = this.gemset[gemPos][0];

				// If gemToMatch not set OR if gem color doesn't match gemToMatch
				if (!gemToMatch || gemToMatch !== gemColor) {
					// Reset gemToMatch to current gem color
					gemToMatch = gemColor;

					// If streak didn't reach 3 or more, then remove "match" class from 
					// gems that aren't part of streak (this is marked with "remove" class)
					if (streak < 3) {
						$(col + ".gem_match").not(".remove").removeClass("gem_match");
					}

					// Restart streak and mark current gem to "match" EXCEPT if it's last gem
					// in row
					if (i !== len) {
						$gem.addClass("gem_match");
					}

					// Also reset streak to 1
					streak = 1;
				} else if (gemToMatch === gemColor) {
					// Increase streak
					streak++;

					// Mark current gem as "match"
					$gem.addClass("gem_match");

					// Once hit streak of 3 or more, add "remove" class to current gem
					// AND previous gems. By this point there shouldn't be any other gems
					// marked as "match" as it would have cleared with the above check
						
					// Once streak hits 3, mark previous "matched" gems for removal
					if (streak === 3) {
						$(col + ".gem_match").addClass("remove");
					} else if (streak > 3) {
						// Every matching gem after that, mark to "remove" individually
						$gem.addClass("remove");
					}
				}

				// If at the last gem in row, clear out non-streak matching gems
				if (i === len) {
					$(col + ".gem_match").not(".remove").removeClass("gem_match");
				}
			}
			
			return this;
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
					gemClass = gem.className,
					otherGemClass = otherGem.className,
					gemColor = this._fetchTileInfo(gem)[0],
					otherGemColor = this._fetchTileInfo(otherGem)[0],
					gemId = gem.id,
					otherGemId = otherGem.id;

			// Update tile ID with gem position
			gem.id = otherGemId;
			otherGem.id = gemId;

			// Update tile classes
			gem.className = otherGemClass;
			otherGem.className = gemClass;

			// Update gemset gem color/type object after gems have swapped
			this.gemset[gemPos][0] = otherGemColor;
			this.gemset[otherGemPos][0] = gemColor;

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
			// gem = "<div id=\"tile_gemPos_" + gemPos + "\" class=\"tile " + gemRow + " " + gemCol + "\" style=\"background-color: " + gemColor + "; top: " + gemYPos+ "px; left: " + gemXPos + "px; width: " + this.gemDimensions + "px; height: " + this.gemDimensions + "px; \" data-position=\"" + gemPos + "\"><\/div>";

			// Create gem and start gem position above gameboard
			gem = "<div id=\"tile_gemPos_" + gemPos + "\" class=\"tile " + gemRow + " " + gemCol + "\" style=\"background-color: " + gemColor + "; top: -" + this.gemDimensions + "px; left: " + gemXPos + "px; width: " + this.gemDimensions + "px; height: " + this.gemDimensions + "px; \" data-position=\"" + gemPos + "\"><\/div>";

			// Add gem to board
			this.$targ.prepend(gem);

			// Animate gem into new position
			$("#tile_gemPos_" + gemPos).animate({top: gemYPos + "px"}, 600);

			return gem;
		},
		createGameboard: function () {
			var col = 1,
					row = 1,
					gemPos = 1,
					gems = "";

			// Start from col 1 and go to max # gems per row
			// Once reach end, reset and go to next row until reach
			// last row (ie. row === this.gemsPerRow)
			while (col <= this.gemsPerRow) {

				// Create gem element
				// gems += this.createNewGems(row, col, gemPos);
				this.createNewGems(row, col, gemPos);

				// Increment gem position
				gemPos++;

				// When reach end of row, go to next row as long as not on last row
				if (col === this.gemsPerRow && row !== this.gemsPerRow) {
					// Reset col to 1
					col = 1;

					// Once reach end of row, increase row #
					row++;
				} else {
					// Go to next column number
					col++;
				}
			}

			// Add gems to target gameboard
			// this.$targ.append(gems);

			this.scanRowsCols();

			return this;
		},
		scanRowsCols: function (row, col) {
			var i = 1;

			// If no row or col param is specified, then scan all rows and columns
			if (!row || !col) {
				for (; i <= this.gemsPerRow; i++) {
//					console.log("i: " + i);
					this._hasHorizontalStreak(".row_" + i);
					this._hasVerticalStreak(".col_" + i);
				}
			} else {
				this._hasHorizontalStreak(row);
				this._hasVerticalStreak(col);
			}

			// If there are gems marked to be remove, trigger
			// "remove" event
			if (this.$targ.find(".remove").length > 0) {
				this.$targ.trigger("removeGems");
			}

			// TODO: If no possible streaks can be made with a swap, then
			// 			 prompt user with message and create new gameboard

			return this;
		},
		removeGems: function () {
			var self = this,
					removedGems = {},
					gemPos,
					col,
					row,
					gemInGemset,
					removedGem;

        console.log(self.$targ.find(".remove"));
			[].forEach.call(self.$targ.find(".remove"), function (gem, idx, arr) {
				gemPos = gem.getAttribute("data-position");
				gemInGemset = self.gemset[gemPos];
				// The gem row will be used to help start
				row = gemInGemset[1];

				// The gem column will be the key in the removedGems object for reference
				col = gemInGemset[2];

//				removedGem = removedGems[col];

				// Fade out gems to be removed and then remove them
				$(gem).fadeOut(300, function (e) {
					// Remove gem
					$(this).remove();

					// Also trigger scoreboard
					self.scoreboard.trigger("changeScore", { points: 10 });

					// TODO: Should I trigger "removeGem" event and remove method
					//			 removes 1 gem at a time? Then as

				});

				// Keep track of what row the last gem removed in column is
        // If the gem col doesn't exist in removedGems object OR it does exist
        // AND the current gem row is greater than the gem col stored row is less than
        // current gem's row
        // Simply want to grab the bottom-most remove gem in each column
        if ((removedGems[col] && (removedGems[col][0]< row)) || !removedGems[col]) {
    				removedGems[col] = [row, col];
        }
      });

			// After remove all gems, trigger moveGems to shift all gems into place
			self.$targ.trigger("moveGems", {removedGems: removedGems});

			return self;
		},
		moveGems: function (removedGems) {
			var self = this,
					col,
					gem,
					removedGem,
					newGems = "";

					console.log(removedGems);
//                         return;


			// As cycle through all removedGems, each gem is passed
			// into moveGem to help shift all gems in the the removed gem column
			// to it's appropriate spot
			var moveGem = function (gemCol) {
				var col = gemCol[1],
						$cols = $(".col_" + col),
						btmRow = gemCol[0] - 1,			// Index of bottom-most removed gem in column
						i = btmRow,
						$colGem,
						removedCount = 1,
						newGems = "";

				console.log("btmRow: " + btmRow);
				console.log("col: " + col);
				console.log("i: " + i);
				console.log($cols);

				// Starting at bottom-most removed gem, loop through gems in the column
				for (; i >= 0; i--) {
					$colGem = $($cols[i]);
					console.log($cols[i]);
					// If gem is marked to be removed, increment count
					if ($colGem.hasClass("remove")) {
						// After the first removed gem, increment counter
						if (i < btmRow) {
							removedCount++;
						}
							
						// console.log("removedCount: " + removedCount);
						// console.log("col: " + col);
						// console.log("gemPos: " + $colGem.attr("data-position"));

						// Replace removed gem with new ones
						// newGems += self.createNewGems(removedCount, col, $colGem.attr("data-position"));
						self.createNewGems(removedCount, col, $colGem.attr("data-position"));
					} else {
						console.log("=-=-==-==-==-=-=-=-=-");
						console.log("removed count: " + removedCount);
						console.log("move top by: " + (removedCount * self.gemDimensions));
						// Else, move remaining gem
						$colGem.animate({
							top: "+=" + (removedCount * self.gemDimensions)
						}, 800, function () {
							console.log(this);
							console.log(this.style.top);
						});
					}
				}

				// Add new gems to gameboard
				// var addGems = setTimeout(function () {
				// 	// self.$targ.prepend(newGems);
				// 	clearTimeout(addGems);
				// }, 2000);

				// When creating new gems, need the following:
				// 1. Column targeting
				// 2. # of removed gems - eg. if 2 removed gems can set row and col classes
				//														as well as position of gem

			};

			// Cycle through removedGems object
			// Each column marked in object will have total # of gems removed in 
			// that column
			for (gem in removedGems) {
				if (removedGems.hasOwnProperty(gem)) {
					removedGem = removedGems[gem];

					moveGem(removedGem);

					// newGems += ;
				}
			}


			// console.log(removedGems);
			// console.log(newGems);

			// self.$targ.prepend(newGems);

			// After all gems have moved to fill in the gaps, trigger
			// new gem creation and pass in the removed gems to they can be
			// replaced with newly created ones
			// self.$targ.trigger("createGems", { removedGems: removedGems });
			
			return self;			
		},
		selectTile: function (gem) {
			var firstGem,
					adjacentGem,
					$gem = $(gem);

			// Check to see one has already been selected via a true/false flag
			if (this.gemSelected) {
				firstGem = this.targ.querySelector(".selected"),
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
				this.swapGems(firstGem, adjacentGem);
			} else {
				// MAYBE?
				// If first selected, could find all adjacent tiles and add a class/attribute
				// to mark it as adjacent. If not, then return false;

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
					othergemPosY = otherGem.style.top,
					gemPos = gem.getAttribute("data-position"),
					otherGemPos = otherGem.getAttribute("data-position");

			// Animate swap of tile positions
			$(gem).animate({
				top: othergemPosY,
				left: othergemPosX
			}, 500);

			$(otherGem).animate({
				top: gemPosY,
				left: gemPosX
			}, 500, function () {
				// Trigger these after animation finishes

				// Update the swapped gems so when we scan for gem streaks, we have the correct info
				self._updateSwappedTilesInfo(gem, otherGem);

				// Trigger "swap" event and pass in row/col data as once this event is triggered
				// we will invoke the scanRowsCols method to see if we have matches
				self.$targ.trigger("swap", { gems: [self._fetchTileInfo(gem), self._fetchTileInfo(otherGem)] });
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
			var currentScore = this.currentScore;

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