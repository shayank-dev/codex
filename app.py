from flask import Flask, render_template, request, redirect, url_for, flash
from flask_sqlalchemy import SQLAlchemy
from flask_wtf import FlaskForm
from wtforms import StringField, DecimalField, TextAreaField, SubmitField
from wtforms.validators import DataRequired, NumberRange
from werkzeug.utils import secure_filename
import os

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///db.sqlite3'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'change-me')
app.config['UPLOAD_FOLDER'] = os.path.join('static', 'uploads')
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

db = SQLAlchemy(app)
with app.app_context():
    db.create_all()

class Pigeon(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(80), nullable=False)
    description = db.Column(db.Text, nullable=False)
    price = db.Column(db.Numeric(10, 2), nullable=False)
    image = db.Column(db.String(120))

class PigeonForm(FlaskForm):
    name = StringField('Name', validators=[DataRequired()])
    description = TextAreaField('Description', validators=[DataRequired()])
    price = DecimalField('Price', places=2, validators=[DataRequired(), NumberRange(min=0)])
    submit = SubmitField('Save')


@app.route('/')
def index():
    pigeons = Pigeon.query.all()
    return render_template('index.html', pigeons=pigeons)

@app.route('/add', methods=['GET', 'POST'])
def add_pigeon():
    form = PigeonForm()
    if form.validate_on_submit():
        filename = None
        file = request.files.get('image')
        if file and file.filename:
            filename = secure_filename(file.filename)
            file.save(os.path.join(app.config['UPLOAD_FOLDER'], filename))
        pigeon = Pigeon(name=form.name.data, description=form.description.data,
                        price=form.price.data, image=filename)
        db.session.add(pigeon)
        db.session.commit()
        flash('Pigeon added!')
        return redirect(url_for('index'))
    return render_template('add.html', form=form)

@app.route('/edit/<int:pigeon_id>', methods=['GET', 'POST'])
def edit_pigeon(pigeon_id):
    pigeon = Pigeon.query.get_or_404(pigeon_id)
    form = PigeonForm(obj=pigeon)
    if form.validate_on_submit():
        filename = pigeon.image
        file = request.files.get('image')
        if file and file.filename:
            filename = secure_filename(file.filename)
            file.save(os.path.join(app.config['UPLOAD_FOLDER'], filename))
        form.populate_obj(pigeon)
        pigeon.image = filename
        db.session.commit()
        flash('Pigeon updated!')
        return redirect(url_for('index'))
    return render_template('edit.html', form=form, pigeon=pigeon)

@app.route('/delete/<int:pigeon_id>', methods=['POST'])
def delete_pigeon(pigeon_id):
    pigeon = Pigeon.query.get_or_404(pigeon_id)
    db.session.delete(pigeon)
    db.session.commit()
    flash('Pigeon deleted!')
    return redirect(url_for('index'))

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0')
