  Score = class Score {
    constructor(date, summary, notes) {
      this.date = date;
      this.summary = summary;
      this.notes = notes;
    }
  
    dateId() {
      return this.date.format("{yyyy}-{MM}-{dd}");
    }
  
    dateStr() {
      return this.date.format("{d} {Mon} {yyyy}");
    }
  
    weekday() {
      return this.date.format("{Weekday}");
    }
  
    text() {
      var re;
      re = /#\w+/gi;
      return this.notes.replace(re, function (str) {
        var code;
        code = `onShowSearch('${str}')`;
        return `<a onclick=${code}>${str}</a>`;
      });
    }
  
    styleClass() {
      if (this.summary == null) {
        return 'val0';
      }
      return 'val' + this.summary;
    }
}

  FaveDayApp = class FaveDayApp {
  
    constructor() {
      this.showSearch = this.showSearch.bind(this);
      this.tmplScores = Hogan.compile($('#tmpl-scores').html());
      
      $('#search input').keyup(() => {
        if (this.searchTime != null) {
          window.clearTimeout(this.searchTime);
        }
        return this.searchTime = window.setTimeout(this.showSearch, 500);
      });

      this.all = this.loadScoresFromFiles();
      this.all.sort((a, b) => b.date - a.date);
      this.onScoreLoaded();
    }
    
    loadScoresFromFiles() {
      let files = [];
      for(let i = 2008; i <= 2020; i++) {
        files.push(`scores-${i}.txt`);
      }
      
      let lines= [];
      for (let file of files) {
        let txtFile = new XMLHttpRequest();

        txtFile.open("GET", `http://localhost:8080/scores/${file}`, false); // TODO: make async
        txtFile.send();
        
        if (txtFile.readyState === 4 && txtFile.status === 200) {
          let newLines = txtFile.responseText.split('\n')
          lines = lines.concat(newLines);
        }
      }
      
      let scores = []
      for (let line of lines) {
        let parts = line.split(',');
        
        let date = new Date(parts[0]);
        let score = parts[1];
        let desc = parts.slice(2).join(',');
        
        scores.push(new Score(date, score, desc));
      }
      
      return scores;
    }

    setupDemoUser() {
      var i, score;
      $('#userName').html('Demo User');
      this.all = (function() {
        var j, results;
        results = [];
        for (i = j = 0; j <= 800; i = ++j) {
          results.push(score = new Score(Date.create().addDays(-i), Math.floor((Math.random() * 5) + 1), demoNotes.sample()));
        }
        return results;
      })();
      return this.onScoreLoaded();
    }

    onScoreLoaded() {
      this.years = (() => {
        const startYear = this.all.first().date.getFullYear();
        const endYear = this.all.last().date.getFullYear();
        const yearRange = [];

        for (let year = startYear; year <= endYear; year++) {
          yearRange.push(year);
        }

        return yearRange;
      }).apply(this);

      $('#topArea').show();
      $('#loading').hide();
      
      return this.showDashboard();
    }

    showError() {
      return this.render('#tmpl-landing', '#content', {
        error: 'Could not connect :-('
      }, {});
    }

    render(templateId, viewId, atts, partials) {
      var view;
      view = Hogan.compile($(templateId).html());
      return $(viewId).html(view.render(atts, partials));
    }

    toggleScoreDialogue() {
      if ($('#addScore').is(':visible')) {
        $('#addScore').hide();
        $('#addScoreBtn .btn').removeClass('active');
      } else {
        $('#datePicker').text(Date.create().format("{dd}-{mm}-{yyyy}"));
        $('#addScoreBtn .btn').addClass('active');
        $('#addScore').show();
      }
    }

    showDashboard() {
      var bestScores, recent, toDate, toMonth, today, todayScores;
      $('#search input')[0].value = "";
      recent = this.all.slice(0, 3);
      
      bestScores = this.all.filter(function(s) {
        return s.summary === 5;
      }).sample();
      
      today = Date.create();
      toDate = today.getDate();
      toMonth = today.getMonth();
      
      todayScores = this.all.filter(s =>
        s.date.getDate() === toDate && s.date.getMonth() === toMonth
      );
      
      return this.render('#tmpl-dashboard', '#content', {
        recentScores: this.tmplScores.render({
          scores: recent
        }),
        bestScores: this.tmplScores.render({
          scores: bestScores
        }),
        todayScores: this.tmplScores.render({
          scores: todayScores
        }),
        years: this.years.map(function(y) {
          return {
            year: y
          };
        })
      }, {
        yearsBar: Hogan.compile($('#tmpl-years-bar').html())
      });
    }

    hasMonth(date) {
      const isMonthFound = this.all.some(s =>
        s.date.getMonth() === date.getMonth() && s.date.getYear() === date.getYear()
      );

      return isMonthFound ? date.format("{yyyy}-{MM}") : null;
    }

   showMonth(id) {
      var date, monthScores, nextMonthDate, nextYearDate, prevMonthDate, prevYearDate, title;
      date = Date.create(id);
      title = date.format('{Month} {yyyy}');

      monthScores = this.all.filter(s =>
        s.date.getMonth() === date.getMonth() && s.date.getYear() === date.getYear()
      );

      prevYearDate = new Date(date).addYears(-1);
      prevMonthDate = new Date(date).addMonths(-1);
      nextMonthDate = new Date(date).addMonths(1);
      nextYearDate = new Date(date).addYears(1);
      
      return this.render('#tmpl-month', '#content', {
        title: title,
        scores: monthScores.isEmpty() ? [] : this.tmplScores.render({
          scores: monthScores
        }),
        years: this.years.map(function(y) {
          return {
            year: y
          };
        }),
        prevYear: this.hasMonth(prevYearDate),
        prevMonth: this.hasMonth(prevMonthDate),
        nextMonth: this.hasMonth(nextMonthDate),
        nextYear: this.hasMonth(nextYearDate)
      }, {
        yearsBar: Hogan.compile($('#tmpl-years-bar').html()),
        monthBar: Hogan.compile($('#tmpl-month-bar').html())
      });
    }

     updateRandomInspiration() {
      const bestScores = this.all.filter(s => s.summary === 5).sample();
      return $('#bestScores').html(this.tmplScores.render({ scores: bestScores }));
    }

     showYears() {
      var byYear, getColorForVal, getYearInspiration, getYearMonths, inspiration, interpCol, j, k, len, len1, maxAvg, minAvg, month, ref, year, yearScore, yearScores, yearsScores;

      const lerp = (t, a, b, i) =>
        Math.floor(t * parseInt(a[i], 16) + (1 - t) * parseInt(b[i], 16));
      
      interpCol = function(t, col1, col2) {
        var c1, c2;
        c1 = [col1.slice(1, 3), col1.slice(3, 5), col1.slice(5, 7)];
        c2 = [col2.slice(1, 3), col2.slice(3, 5), col2.slice(5, 7)];
        return `rgb(${lerp(t, c1, c2, 0)}, ${lerp(t, c1, c2, 1)}, ${lerp(t, c1, c2, 2)})`;
      };

      getColorForVal = val => {
        if (val >= 5.00) return '#33AA66';
        if (val >= 4.00) return interpCol(val - 4, '#9AD600', '#33AA66');
        if (val >= 3.00) return interpCol(val - 3, '#FFAD26', '#9AD600');
        if (val >= 2.00) return interpCol(val - 2, '#FFB399', '#FFAD26');
        if (val >= 1.00) return interpCol(val - 1, '#FF794D', '#FFB399');
      };

      getYearMonths = function(yearScores) {
        return Object.values(yearScores.groupBy(function(s) {
          return s.date.getMonth();
        })).map(function(scores) {
          return {
            val: scores.average(function(s) {
              return s.summary;
            }),
            dateId: scores.first().date.format("{yyyy}-{MM}")
          };
        });
      };

      getYearInspiration = (yearScores) => {
        const inspiration = yearScores
          .filter(s => s.summary >= 4)
          .sample(2)
          .sortBy(s => s.date, true);

        return inspiration.isEmpty() ? null : this.tmplScores.render({ scores: inspiration });
      };

      byYear = this.all.groupBy(s => s.date.getFullYear());

      yearsScores = (function() {
        var results;
        results = [];
        for (year in byYear) {
          yearScores = byYear[year];
          results.push({
            year: year,
            totalAvg: yearScores.average(function(s) {
              return s.summary;
            }).format(2),
            totalCount: yearScores.length,
            months: getYearMonths(yearScores),
            inspiration: getYearInspiration(yearScores)
          });
        }
        return results;
      })();
      
      maxAvg = yearsScores.map(function(s) {
        return s.months.max(function(m) {
          return m.val;
        }).first().val;
      }).max().first();
      
      minAvg = yearsScores.map(function(s) {
        return s.months.min(function(m) {
          return m.val;
        }).first().val;
      }).min().first();
      
// calculate colors for each month in second step
      for (j = 0, len = yearsScores.length; j < len; j++) {
        yearScore = yearsScores[j];
        ref = yearScore.months;
        for (k = 0, len1 = ref.length; k < len1; k++) {
          month = ref[k];
          month.col = getColorForVal(1 + 4 * (month.val - minAvg) / (maxAvg - minAvg));
          month.val = month.val.format(2);
        }
      }
      
      inspiration = (function() {
        var results;
        results = [];
        for (year in byYear) {
          yearScores = byYear[year];
          results.push({
            year: year,
            insp: getYearInspiration(yearScores)
          });
        }
        return results;
      })();
      
      return this.render('#tmpl-years', '#content', {
        scores: yearsScores.reverse(),
        inspiration: inspiration.filter(function(i) {
          return i.insp != null;
        }).reverse(),
        years: this.years.map(function(y) {
          return {
            year: y
          };
        })
      }, {
        yearsBar: Hogan.compile($('#tmpl-years-bar').html())
      });
    }

     showYear(id) {
      var bestScores, byMonth, countVal, i, month, months, randomScores, scores, yearScores;
      countVal = function(scores, val) {
        var ct, i;
        
        ct = scores.count(function(s) {
          return s.summary === val;
        });
        
        return {
          val: val,
          full: (function() {
            var j, ref, results;
            results = [];
            for (i = j = 0, ref = Math.floor(ct / 5); (0 <= ref ? j < ref : j > ref); i = 0 <= ref ? ++j : --j) {
              results.push(i);
            }
            return results;
          })(),
          part: (function() {
            var j, ref, results;
            results = [];
            for (i = j = 0, ref = ct % 5; (0 <= ref ? j < ref : j > ref); i = 0 <= ref ? ++j : --j) {
              results.push(i);
            }
            return results;
          })()
        };
      };
      
      id = parseInt(id);
      yearScores = this.all.filter(function(s) {
        return s.date.getFullYear() === id;
      });
      
      byMonth = yearScores.groupBy(function(s) {
        return s.date.getMonth();
      });
      
      months = (function() {
        var results;
        results = [];
        for (month in byMonth) {
          scores = byMonth[month];
          results.push({
            date: Date.create(`${id}-${parseInt(month) + 1}`).format('{Mon} {yyyy}'),
            dateId: `${id}-${parseInt(month) + 1}-1`,
            avg: scores.average(function(s) {
              return s.summary;
            }).format(2),
            counts: (function() {
              var j, results1;
              results1 = [];
              for (i = j = 5; j >= 1; i = --j) {
                results1.push(countVal(scores, i));
              }
              return results1;
            })()
          });
        }
        return results;
      })();
      
      months.reverse();
      randomScores = yearScores.filter(function(s) {
        return s.summary >= 3;
      }).sample(5);
      
      bestScores = yearScores.filter(function(s) {
        return s.summary === 5;
      }).sample(2).sortBy((function(s) {
        return s.date;
      }), true);
      
      return this.render('#tmpl-year', '#content', {
        year: id,
        scores: randomScores.isEmpty() ? [] : this.tmplScores.render({
          scores: randomScores
        }),
        inspiration: bestScores.isEmpty() ? [] : this.tmplScores.render({
          scores: bestScores
        }),
        months: months,
        years: this.years.map(function(y) {
          return {
            year: y
          };
        })
      }, {
        yearsBar: Hogan.compile($('#tmpl-years-bar').html())
      });
    }

     showSearch(id) {
      var date, elem, foundScores, j, k, keyword, keywords, len, len1, needle, needleDate, range, ref, ref1, ref2, regex, results, score;
      id = $('#search input')[0].value;
      if (id.length < 1) {
        return this.showDashboard();
      }
      foundScores = this.all;
      keywords = [];
      ref = id.split(' ');
      
      for (j = 0, len = ref.length; j < len; j++) {
        needle = ref[j];
        if (needle.length < 1) {
          continue;
        }
        needle = needle.toLowerCase();
        // score criterium
        if (((ref1 = needle[0]) === '>' || ref1 === '<' || ref1 === '=') && needle.length === 2) {
          score = parseInt(needle[1]);
          range = needle[0] === '>' ? (function() {
            var results = [];
            for (var k = score; score <= 5 ? k <= 5 : k >= 5; score <= 5 ? k++ : k--){ results.push(k); }
            return results;
          }).apply(this) : needle[0] === '<' ? (function() {
            var results = [];
            for (var k = 0; 0 <= score ? k <= score : k >= score; 0 <= score ? k++ : k--){ results.push(k); }
            return results;
          }).apply(this) : [score];
          foundScores = foundScores.filter(function(s) {
            var ref2;
            return ref2 = s.summary, indexOf.call(range, ref2) >= 0;
          });
        } else if (needle.last() === '.' && parseInt(needle)) {
          needleDate = parseInt(needle);
          foundScores = foundScores.filter(function(s) {
            return s.date.getDate() === needleDate;
          });
        } else {
          // arbitrary date criterium
          date = Date.create(needle);
          if (date.isValid()) {
            foundScores = foundScores.filter(function(s) {
              return s.date.is(needle);
            });
          // text criterium
          } else if (needle.length > 2) {
            foundScores = foundScores.filter(function(s) {
              return s.notes.toLowerCase().indexOf(needle) > -1;
            });
            keywords.push(needle);
          }
        }
      }
      
      this.render('#tmpl-search', '#content', {
        count: foundScores.length,
        average: foundScores.average(function(s) {
          return s.summary;
        }).format(2),
        scores: this.tmplScores.render({
          scores: foundScores
        }),
        years: this.years.map(function(y) {
          return {
            year: y
          };
        })
      }, {
        yearsBar: Hogan.compile($('#tmpl-years-bar').html())
      });
      
      ref2 = $('.notes');
      results = [];
      for (k = 0, len1 = ref2.length; k < len1; k++) {
        elem = ref2[k];
        results.push((function() {
          var len2, n, results1;
          results1 = [];
          for (n = 0, len2 = keywords.length; n < len2; n++) {
            keyword = keywords[n];
            regex = new RegExp(`(${keyword})`, 'ig');
            results1.push($(elem).html(elem.textContent.replace(regex, "<strong>$1</strong>")));
          }
          return results1;
        })());
      }
      return results;
    }
  }

  //@showPlot()

  // showPlot: () ->
  //   <% data_vals = plot_data_months @avg_months %>

  //   var plotData = [{
  //     data:[<%= data_vals.join(',') %>],
  //     <%= plot_style data_vals %>
  //   }];

  //   var plotOptions = {
  //     grid: {
  //       borderWidth: 0,
  //       markings: [<%= plot_markings_months @months %>]
  //     },
  //     xaxis: {ticks: [<%= plotXAxisMonths @months %>]},
  //     yaxis: {minTickSize: 0.5, tickDecimals: 1}
  //   };

  //   $.plot($("#plot"), plotData, plotOptions);
  
  window.onload = function() {
    return window.app = new FaveDayApp();
  };

  window.onConnect = function() {
    return window.app.setupDropbox();
  };

  window.onShowMonth = function(id) {
    return window.app.showMonth(id);
  };

  window.onShowYear = function(id) {
    return window.app.showYear(id);
  };

  window.onShowYears = function() {
    return window.app.showYears();
  };

  window.onShowDashboard = function() {
    return window.app.showDashboard();
  };

  window.onUpdateRandomInspiration = function() {
    return window.app.updateRandomInspiration();
  };

  window.onToggleScoreDialogue = function() {
    return window.app.toggleScoreDialogue();
  };

  window.onCancelScoreDialogue = function() {
    return window.app.cancelScoreDialogue();
  };

  window.onShowSearch = function(id) {
    if (id != null) {
      $('#search input')[0].value = id;
    }
    return window.app.showSearch(id);
  };
  
  // Call onAppStart when the window loads
  function onAppStart() {
    var app = new FaveDayApp();
  };

