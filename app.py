from flask import Flask, render_template, request, redirect, url_for

app = Flask(__name__)

# In-memory list to store pigeon listings
pigeons = []

@app.route('/')
def index():
    return render_template('index.html', pigeons=pigeons)

@app.route('/add', methods=['GET', 'POST'])
def add_pigeon():
    if request.method == 'POST':
        name = request.form.get('name')
        description = request.form.get('description')
        price = request.form.get('price')
        pigeons.append({'name': name, 'description': description, 'price': price})
        return redirect(url_for('index'))
    return render_template('add.html')

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0')
