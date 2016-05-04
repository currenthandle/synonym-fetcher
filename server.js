var fs = require('fs')
var request = require('request')
var express = require('express');
var bodyParser = require('body-parser');
var app     = express();
var cheerio = require('cheerio')
var hyperstream = require('hyperstream')
var h = require('virtual-dom/h')
var createElement = require('virtual-dom/create-element')


//Note that in version 4 of express, express.bodyParser() was
//deprecated in favor of a separate 'body-parser' module.
app.use(bodyParser.urlencoded({ extended: true })); 

//app.use(express.bodyParser());

app.post('/myaction', function(req, res) {
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
		console.log('S',synonyms)
		var queries = [word].concat(synonyms)
		var resp = crawl(queries, res)


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

var limit = 140
var query 
var pos = 0
var sentenceBegining
var sentenceEnd

function crawl(queries, res) {
	console.log('in crawl')
	var results = []
	var files = fs.readdirSync('files')
	files.forEach(function(file){
		var data = fs.readFileSync('files/'+file)
		var $ = cheerio.load(data);
		var text = $('p').text();
		text = text.replace(/\s\s+/g, ' ')

		for(var g = 0; g < queries.length; g++){
			//console.log('queries', queries)
			query = queries[g]		
			//console.log('query',query)
			pos = text.indexOf(query)
			if (pos >= 0) { break } 
		}	

		sentenceBegining = 0
		sentenceEnd = pos + 140

		for(var i = pos - 1; i >= 0; i--){
			if(text.charAt(i) === '.'){
				sentenceBegining = i + 2
				break
			}
		}
		for (var j = pos + query.length + 1; j < data.length; j++) {
			if (text.charAt(j) === '.') {
				sentenceEnd = j + 1
				break
			}
		}
		var sentenceLength = sentenceEnd - sentenceBegining
		if (sentenceLength <= limit){
			sentence = text.substring(sentenceBegining, sentenceEnd)
		} else {
			sentence = text.substring(pos - limit / 2, pos + limit /2)
		}
		//console.log(sentence)
		
		console.log('query', query)
		console.log('sentence', sentence)

		var node = h('div', [
			h('div', file),
			h('div', [
				sentence.substring(0, query),
				h('span', {class: 'query'}, query),
				sentence.substring(query+query.length)
			]),
			h('br')
		])

		sentence = sentence.replace(query, '<b>' + query + '</b>')

		results.push(node)
		
	})
	return results
	console.log('results', results)
}


app.listen(8080, function() {
  console.log('Server running at http://127.0.0.1:8080/');
});
