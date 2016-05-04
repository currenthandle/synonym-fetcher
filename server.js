var fs = require('fs')
var request = require('request')
var express = require('express');
var bodyParser = require('body-parser');
var app     = express();
var cheerio = require('cheerio')
var hyperstream = require('hyperstream')
var h = require('virtual-dom/h')
var createElement = require('virtual-dom/create-element')


app.use(bodyParser.urlencoded({ extended: true })); 

//app.use(express.bodyParser());

app.post('/search', function(req, res) {
	var word = 'present'
	word = req.body.word
	request("http://thesaurus.altervista.org/service.php?word="+word+"&language=en_US&output=json&key=SS3IcLAnzS2CcXXDH6UC", function (err, resp, content){
		var result = JSON.parse(content)
		var synonyms = result.response.reduce(function(prev, current){
			return prev.concat(current.list.synonyms.split('|'))
		}, [])
		.filter(function(element){
			return element.indexOf('(') === -1
		})
		//console.log('S',synonyms)
		var queries = [word].concat(synonyms)
		var resp = crawl(queries)


		var virtualNode = h('div', resp)
		var html = createElement(virtualNode).toString()
        fs.createReadStream('public/index.html')
            .pipe(hyperstream({
                '#content': html
            }))
            .pipe(res)	
		})  
		//res.send('You sent the name "' + req.body.word+ '".');
});

app.use(express.static(__dirname + '/public'))


function crawl(queries) {
	//console.log('in crawl')
	var limit = 140
	var query 
	var pos = 0
	var sentence = ''
	var sentenceBegining
	var sentenceEnd
	var results = []
	var files = fs.readdirSync('files')
	files.forEach(function(file){
		var data = fs.readFileSync('files/'+file)
		var $ = cheerio.load(data);
		var text
		var passed = false

		if(file === 'w00091.html'){
			console.log(queries)
		}
		for(var g = 0; g < queries.length; g++){
			var text = $('p').text();
			text = text.replace(/\s\s+/g, ' ')
			query = queries[g]		
			
			pos = text.indexOf(query)
			if (pos >= 0 ) { 	//query is matched somewhere in the file
				var charBefore = text.charAt(pos-1)
				if(file === 'w00091.html'){
					console.log('1', query)
				}
				if(charBefore === ' ' || charBefore === "'" || charBefore === '"' || charBefore === '=' || text.charAt(pos) === text.charAt(pos).toUpperCase()){  //query doesn't have a prefix
					if(file === 'w00091.html'){
						console.log('2', query)
					}
					var charAfter = text.charAt(pos + query.length)	
					if(file === 'w00091.html'){
						console.log(charAfter)
					}
					
					if(charAfter === ',' || charAfter === '.' || charAfter === ' ' || charAfter === '"' || charAfter === "'" || charAfter === '-' ){  //query dosen't have a suffix
						passed = true
						if(file === 'w00091.html'){
							console.log('3', query)
						}
						break 
					}
				}
			} 
		}	
		if (passed) {
			sentenceBegining = 0
			sentenceEnd = pos + 140
			var currentChar = 0
			
			for(var i = pos - 1; i >= 0; i--){
				currentChar = text.charAt(i)
				if (currentChar === '.' || currentChar === '?' || currentChar ==='!') {
					sentenceBegining = i + 2
					break
				}
			}
			for (var j = pos + query.length ; j < text.length; j++) {
				currentChar = text.charAt(j)
				if (currentChar === '.' || currentChar === '?' || currentChar ==='!') {
					sentenceEnd = j
					break
				}
			}
			var sentenceLength = sentenceEnd - sentenceBegining
			if (sentenceLength <= limit){
				sentence = text.substring(sentenceBegining, sentenceEnd+1)
			} else {
				if(pos > sentenceEnd - pos + query.length){  //more characters before query than after
					sentence = text.substring(sentenceBegining, sentenceBegining + limit)
					if(file === 'w00091.html'){
						console.log('1')
						console.log(query)
						console.log(sentence)
					}
				}
				else if(pos < sentenceEnd - pos + query.length){
					if(file === 'w00091.html'){
						console.log('2')
					}
					sentence = text.substring(pos, sentenceEnd+1)
				}
				else {
					if(file === 'w00091.html'){
						console.log('3')
					}
					sentence = text.substring(pos - limit / 2, pos + limit /2)
				}
			}
			var sentencePos = sentence.indexOf(query)

			var node = h('div', {class: 'item'}, [
				h('div', {class: 'file-name'}, file),
				h('div', [
					sentence.substring(0, sentencePos),
					h('span', {class: 'query'}, query),
					sentence.substring(sentencePos+query.length),
					h('br'),
					sentence.length,
					h('br'),
					sentenceLength,
					h('br'),
					query,
					h('br'),
					sentence
					
				])
			])

			results.push(node)
		}
		
	})
	return results
}


app.listen(8080, function() {
  console.log('Server running at http://127.0.0.1:8080/');
});
